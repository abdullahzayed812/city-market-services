import { GlobalProduct } from "../entities/global-product.entity";
import { Category } from "../entities/category.entity";
import { ProductSubmissionStatus } from "@city-market/shared";
import { CatalogCandidate, ProductSubmissionHistoryRecord, ProductSubmissionRecord } from "../entities/product-submission.entity";

export interface ProductSubmissionListFilter {
  vendorId?: string;
  statuses?: ProductSubmissionStatus[];
  search?: string;
  limit: number;
  offset: number;
}

export type SubmissionPatch = Partial<
  Pick<
    ProductSubmissionRecord,
    | "status"
    | "name"
    | "normalizedName"
    | "description"
    | "globalCategoryId"
    | "measurementType"
    | "weightUnit"
    | "imageKey"
    | "imageWidth"
    | "imageHeight"
    | "revision"
    | "vendorAcknowledgedDuplicates"
    | "reviewNote"
    | "reviewedBy"
    | "reviewedAt"
    | "resolution"
    | "reservedGlobalProductId"
    | "globalProductId"
    | "vendorProductId"
    | "submittedAt"
  >
>;

// Work done inside one database transaction. Rows read with lock* stay locked (SELECT ... FOR
// UPDATE) until it commits, which serializes concurrent decisions on the same proposal.
export interface ProductSubmissionTx {
  lockById(id: string): Promise<ProductSubmissionRecord | null>;
  // Locks the global category row: approvals into one category run one at a time, so two
  // proposals with the same name can't both pass the duplicate re-check
  lockGlobalCategory(id: string): Promise<Category | null>;
  insert(record: ProductSubmissionRecord): Promise<void>;
  update(id: string, patch: SubmissionPatch): Promise<void>;
  addHistory(entry: ProductSubmissionHistoryRecord): Promise<void>;
  findCatalogCandidates(likePatterns: string[], globalCategoryId: string | null, limit: number): Promise<CatalogCandidate[]>;
  findLiveGlobalProduct(id: string): Promise<GlobalProduct | null>;
  insertGlobalProduct(product: GlobalProduct): Promise<void>;
  // The store's live vendor_products row for this catalog product, created (price 0, stock 0,
  // not available) through the add-from-catalog logic when missing
  ensureVendorProduct(vendorId: string, globalProductId: string): Promise<{ vendorProductId: string; created: boolean }>;
}

export interface IProductSubmissionRepository {
  findById(id: string): Promise<ProductSubmissionRecord | null>;
  list(filter: ProductSubmissionListFilter): Promise<{ items: ProductSubmissionRecord[]; total: number }>;
  findHistory(submissionId: string): Promise<ProductSubmissionHistoryRecord[]>;
  findCatalogCandidates(likePatterns: string[], globalCategoryId: string | null, limit: number): Promise<CatalogCandidate[]>;
  // Open proposals (any store) whose name contains one of the patterns
  findOpenByName(likePatterns: string[], excludeId: string, limit: number): Promise<ProductSubmissionRecord[]>;
  // Which of these image keys belong to an open proposal
  findOpenImageKeys(keys: string[]): Promise<Set<string>>;
  globalProductExists(id: string): Promise<boolean>;
  withTransaction<T>(fn: (tx: ProductSubmissionTx) => Promise<T>): Promise<T>;
}
