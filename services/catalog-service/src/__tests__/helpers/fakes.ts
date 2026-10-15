import { randomUUID } from "crypto";
import { AppError, CategoryType, ProductSubmissionStatus } from "@city-market/shared";
import { Category } from "../../core/entities/category.entity";
import { GlobalProduct } from "../../core/entities/global-product.entity";
import { CatalogCandidate, ProductSubmissionHistoryRecord, ProductSubmissionRecord } from "../../core/entities/product-submission.entity";
import { ICategoryRepository } from "../../core/interfaces/category.repository";
import { IProductSubmissionRepository, ProductSubmissionListFilter, ProductSubmissionTx } from "../../core/interfaces/product-submission.repository";
import { ISubmissionMedia, SubmissionImageInfo } from "../../core/interfaces/submission-media";
import { SubmissionEventPublisher } from "../../application/services/product-submission.service";

export interface FakeVendorProduct {
  id: string;
  vendorId: string;
  globalProductId: string;
  price: number;
  stockQuantity: number;
  stockWeightGrams: number;
  isAvailable: boolean;
  deletedAt: Date | null;
}

interface State {
  submissions: Map<string, ProductSubmissionRecord>;
  history: ProductSubmissionHistoryRecord[];
  globalProducts: Map<string, GlobalProduct & { deletedAt?: Date | null }>;
  vendorProducts: FakeVendorProduct[];
  categories: Map<string, Category>;
}

const clone = <T>(v: T): T => structuredClone(v);

// Turns "%_رز%"-style LIKE patterns into a RegExp (same semantics as MySQL LIKE)
function likeToRegex(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%") out += ".*";
    else if (c === "_") out += ".";
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`, "is");
}

const OPEN = [ProductSubmissionStatus.PENDING_REVIEW, ProductSubmissionStatus.NEEDS_CHANGES];

// In-memory repository. Transactions run one at a time (a single lock stands in for the row
// locks, which serialize these operations on the real database) and roll back on error.
export class FakeSubmissionRepository implements IProductSubmissionRepository {
  state: State = {
    submissions: new Map(),
    history: [],
    globalProducts: new Map(),
    vendorProducts: [],
    categories: new Map(),
  };
  private txQueue: Promise<unknown> = Promise.resolve();
  // Throws inside the next transaction when that tx operation runs
  failOn: Partial<Record<keyof ProductSubmissionTx, Error>> = {};
  transactions = 0;

  addCategory(id: string, name: string, type: CategoryType = CategoryType.GLOBAL): Category {
    const category: Category = { id, name, type, vendorId: type === CategoryType.VENDOR ? "some-vendor" : null, createdAt: new Date() };
    this.state.categories.set(id, category);
    return category;
  }

  addGlobalProduct(p: Partial<GlobalProduct> & { id: string; name: string; globalCategoryId: string }): GlobalProduct {
    const product = { measurementType: "UNIT", createdAt: new Date(), updatedAt: new Date(), ...p } as GlobalProduct;
    this.state.globalProducts.set(p.id, product);
    return product;
  }

  liveVendorProducts(vendorId: string): FakeVendorProduct[] {
    return this.state.vendorProducts.filter((v) => v.vendorId === vendorId && !v.deletedAt);
  }

  async findById(id: string) {
    const s = this.state.submissions.get(id);
    return s ? this.decorate(clone(s)) : null;
  }

  async list(filter: ProductSubmissionListFilter) {
    let items = Array.from(this.state.submissions.values());
    if (filter.vendorId) items = items.filter((s) => s.vendorId === filter.vendorId);
    if (filter.statuses?.length) items = items.filter((s) => filter.statuses!.includes(s.status));
    if (filter.search) items = items.filter((s) => s.name.toLowerCase().includes(filter.search!.toLowerCase()));
    items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    return { items: items.slice(filter.offset, filter.offset + filter.limit).map((s) => this.decorate(clone(s))), total: items.length };
  }

  async findHistory(submissionId: string) {
    return clone(this.state.history.filter((h) => h.submissionId === submissionId));
  }

  async findCatalogCandidates(likePatterns: string[], globalCategoryId: string | null, limit: number): Promise<CatalogCandidate[]> {
    const regexes = likePatterns.map(likeToRegex);
    return Array.from(this.state.globalProducts.values())
      .filter((p) => !p.deletedAt && regexes.some((r) => r.test(p.name)))
      .filter((p) => !globalCategoryId || p.globalCategoryId === globalCategoryId)
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl ?? null,
        globalCategoryId: p.globalCategoryId,
        globalCategoryName: this.state.categories.get(p.globalCategoryId)?.name ?? null,
        measurementType: p.measurementType,
        weightUnit: p.weightUnit ?? null,
      }));
  }

  async findOpenByName(likePatterns: string[], excludeId: string, limit: number) {
    const regexes = likePatterns.map(likeToRegex);
    return Array.from(this.state.submissions.values())
      .filter((s) => OPEN.includes(s.status) && s.id !== excludeId && regexes.some((r) => r.test(s.name)))
      .slice(0, limit)
      .map((s) => clone(s));
  }

  async findOpenImageKeys(keys: string[]) {
    return new Set(
      Array.from(this.state.submissions.values())
        .filter((s) => OPEN.includes(s.status) && keys.includes(s.imageKey))
        .map((s) => s.imageKey),
    );
  }

  async globalProductExists(id: string) {
    return this.state.globalProducts.has(id);
  }

  withTransaction<T>(fn: (tx: ProductSubmissionTx) => Promise<T>): Promise<T> {
    const run = async () => {
      this.transactions++;
      const snapshot = clone(this.state);
      try {
        return await fn(this.createTx());
      } catch (error) {
        this.state = snapshot;
        throw error;
      }
    };
    const result = this.txQueue.then(run, run);
    this.txQueue = result.catch(() => undefined);
    return result;
  }

  private maybeFail(op: keyof ProductSubmissionTx) {
    const error = this.failOn[op];
    if (error) {
      delete this.failOn[op];
      throw error;
    }
  }

  private assertUnique(record: ProductSubmissionRecord) {
    for (const other of this.state.submissions.values()) {
      if (other.id === record.id) continue;
      if (other.imageKey === record.imageKey) throw new AppError(409, "submission_image_already_used");
      if (
        OPEN.includes(record.status) &&
        OPEN.includes(other.status) &&
        other.vendorId === record.vendorId &&
        other.globalCategoryId === record.globalCategoryId &&
        other.normalizedName === record.normalizedName
      ) {
        throw new AppError(409, "duplicate_open_submission");
      }
    }
  }

  private createTx(): ProductSubmissionTx {
    const tick = () => new Promise((r) => setImmediate(r));
    return {
      lockById: async (id) => {
        this.maybeFail("lockById");
        await tick();
        const s = this.state.submissions.get(id);
        return s ? this.decorate(clone(s)) : null;
      },
      lockGlobalCategory: async (id) => {
        this.maybeFail("lockGlobalCategory");
        const c = this.state.categories.get(id);
        return c && c.type === CategoryType.GLOBAL ? clone(c) : null;
      },
      insert: async (record) => {
        this.maybeFail("insert");
        this.assertUnique(record);
        this.state.submissions.set(record.id, clone(record));
      },
      update: async (id, patch) => {
        this.maybeFail("update");
        const current = this.state.submissions.get(id)!;
        const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        const next = { ...current, ...defined, updatedAt: new Date() } as ProductSubmissionRecord;
        this.assertUnique(next);
        this.state.submissions.set(id, next);
      },
      addHistory: async (entry) => {
        this.maybeFail("addHistory");
        this.state.history.push(clone(entry));
      },
      findCatalogCandidates: (patterns, categoryId, limit) => this.findCatalogCandidates(patterns, categoryId, limit),
      findLiveGlobalProduct: async (id) => {
        const p = this.state.globalProducts.get(id);
        return p && !p.deletedAt ? clone(p) : null;
      },
      insertGlobalProduct: async (product) => {
        this.maybeFail("insertGlobalProduct");
        await tick();
        if (this.state.globalProducts.has(product.id)) throw Object.assign(new Error("Duplicate entry for key 'PRIMARY'"), { code: "ER_DUP_ENTRY" });
        this.state.globalProducts.set(product.id, clone(product));
      },
      ensureVendorProduct: async (vendorId, globalProductId) => {
        this.maybeFail("ensureVendorProduct");
        const existing = this.liveVendorProducts(vendorId).find((v) => v.globalProductId === globalProductId);
        if (existing) return { vendorProductId: existing.id, created: false };
        const row: FakeVendorProduct = {
          id: randomUUID(),
          vendorId,
          globalProductId,
          price: 0,
          stockQuantity: 0,
          stockWeightGrams: 0,
          isAvailable: false,
          deletedAt: null,
        };
        this.state.vendorProducts.push(row);
        return { vendorProductId: row.id, created: true };
      },
    };
  }

  private decorate(s: ProductSubmissionRecord): ProductSubmissionRecord {
    s.globalCategoryName = this.state.categories.get(s.globalCategoryId)?.name ?? null;
    s.publishedImageUrl = s.globalProductId ? (this.state.globalProducts.get(s.globalProductId)?.imageUrl ?? null) : null;
    return s;
  }
}

export class FakeCategoryRepository implements Pick<ICategoryRepository, "findById"> {
  constructor(private repo: FakeSubmissionRepository) {}
  async findById(id: string) {
    return this.repo.state.categories.get(id) ?? null;
  }
}

export class FakeMedia implements ISubmissionMedia {
  privateObjects = new Map<string, { width: number; height: number }>();
  publicFolders = new Map<string, string>();
  promoteCalls = 0;
  failPromote: Error | null = null;
  failDeletePrivate = false;

  addPrivate(key: string, width = 1200, height = 900) {
    this.privateObjects.set(key, { width, height });
  }

  async stat(key: string): Promise<SubmissionImageInfo> {
    const o = this.privateObjects.get(key);
    return o ? { exists: true, width: o.width, height: o.height } : { exists: false };
  }

  async signedUrls(keys: string[]) {
    return Object.fromEntries(keys.filter((k) => this.privateObjects.has(k)).map((k) => [k, `https://signed.example/${k}?sig=secret`]));
  }

  async promote(key: string, globalProductId: string) {
    this.promoteCalls++;
    await new Promise((r) => setImmediate(r));
    if (this.failPromote) {
      const error = this.failPromote;
      this.failPromote = null;
      throw error;
    }
    if (!this.privateObjects.has(key)) throw new AppError(404, "submission_image_missing");
    const url = `https://cdn.example/globals/${globalProductId}/large.webp`;
    this.publicFolders.set(globalProductId, url);
    return { url };
  }

  async deletePrivate(key: string) {
    if (this.failDeletePrivate) throw new Error("storage down");
    this.privateObjects.delete(key);
  }

  async deletePublicFolder(globalProductId: string) {
    this.publicFolders.delete(globalProductId);
  }

  async listPrivateOlderThan() {
    return Array.from(this.privateObjects.keys());
  }
}

export class FakeEvents implements SubmissionEventPublisher {
  events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  async publish(event: { type: any; payload: Record<string, unknown> }) {
    this.events.push({ type: event.type, payload: event.payload });
  }
}

export const imageKeyFor = (userId: string) => `product-submissions/${userId}/${randomUUID()}.webp`;
