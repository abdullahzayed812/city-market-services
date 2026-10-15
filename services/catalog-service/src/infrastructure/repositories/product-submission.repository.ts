import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError, CategoryType } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { GlobalProduct } from "../../core/entities/global-product.entity";
import { Category } from "../../core/entities/category.entity";
import { CatalogCandidate, ProductSubmissionHistoryRecord, ProductSubmissionRecord } from "../../core/entities/product-submission.entity";
import {
  IProductSubmissionRepository,
  ProductSubmissionListFilter,
  ProductSubmissionTx,
  SubmissionPatch,
} from "../../core/interfaces/product-submission.repository";
import { VendorProductRepository } from "./vendor-product.repository";

type Queryable = Pool | PoolConnection;

const SELECT_SUBMISSION = `
  SELECT ps.*, gc.name AS global_category_name, gp.image_url AS published_image_url
  FROM product_submissions ps
  LEFT JOIN categories gc ON gc.id = ps.global_category_id
  LEFT JOIN global_products gp ON gp.id = ps.global_product_id`;

const COLUMN_BY_FIELD: Record<keyof SubmissionPatch, string> = {
  status: "status",
  name: "name",
  normalizedName: "normalized_name",
  description: "description",
  globalCategoryId: "global_category_id",
  measurementType: "measurement_type",
  weightUnit: "weight_unit",
  imageKey: "image_key",
  imageWidth: "image_width",
  imageHeight: "image_height",
  revision: "revision",
  vendorAcknowledgedDuplicates: "vendor_acknowledged_duplicates",
  reviewNote: "review_note",
  reviewedBy: "reviewed_by",
  reviewedAt: "reviewed_at",
  resolution: "resolution",
  reservedGlobalProductId: "reserved_global_product_id",
  globalProductId: "global_product_id",
  vendorProductId: "vendor_product_id",
  submittedAt: "submitted_at",
};

// Unique keys of product_submissions -> what the merchant is told
function mapDuplicateKey(error: any): never {
  if (error?.code === "ER_DUP_ENTRY") {
    const message = String(error.sqlMessage ?? error.message ?? "");
    if (message.includes("uq_submission_image")) throw new AppError(409, "submission_image_already_used");
    if (message.includes("uq_submission_open_name")) throw new AppError(409, "duplicate_open_submission");
  }
  throw error;
}

export class ProductSubmissionRepository implements IProductSubmissionRepository {
  private pool: Pool;

  constructor(
    private db: Database,
    private vendorProductRepo: VendorProductRepository,
  ) {
    this.pool = this.db.getPool();
  }

  async findById(id: string): Promise<ProductSubmissionRecord | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(`${SELECT_SUBMISSION} WHERE ps.id = ?`, [id]);
    return rows.length > 0 ? mapSubmission(rows[0]) : null;
  }

  async list(filter: ProductSubmissionListFilter): Promise<{ items: ProductSubmissionRecord[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    if (filter.vendorId) {
      conditions.push("ps.vendor_id = ?");
      params.push(filter.vendorId);
    }
    if (filter.statuses && filter.statuses.length > 0) {
      conditions.push("ps.status IN (?)");
      params.push(filter.statuses);
    }
    if (filter.search) {
      conditions.push("ps.name LIKE ?");
      params.push(`%${filter.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      // Latest submission first, like the other admin lists
      `${SELECT_SUBMISSION} ${where} ORDER BY ps.submitted_at DESC, ps.id DESC LIMIT ? OFFSET ?`,
      [...params, filter.limit, filter.offset],
    );
    const [countRows] = await this.pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM product_submissions ps ${where}`, params);
    return { items: rows.map(mapSubmission), total: Number(countRows[0].count) };
  }

  async findHistory(submissionId: string): Promise<ProductSubmissionHistoryRecord[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM product_submission_history WHERE submission_id = ? ORDER BY created_at ASC, id ASC",
      [submissionId],
    );
    return rows.map(mapHistory);
  }

  async findCatalogCandidates(likePatterns: string[], globalCategoryId: string | null, limit: number): Promise<CatalogCandidate[]> {
    return findCatalogCandidates(this.pool, likePatterns, globalCategoryId, limit);
  }

  async findOpenByName(likePatterns: string[], excludeId: string, limit: number): Promise<ProductSubmissionRecord[]> {
    if (likePatterns.length === 0) return [];
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `${SELECT_SUBMISSION}
       WHERE ps.status IN ('PENDING_REVIEW', 'NEEDS_CHANGES') AND ps.id <> ?
         AND (${likePatterns.map(() => "ps.name LIKE ?").join(" OR ")})
       ORDER BY ps.submitted_at DESC LIMIT ?`,
      [excludeId, ...likePatterns, limit],
    );
    return rows.map(mapSubmission);
  }

  async findOpenImageKeys(keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT image_key FROM product_submissions WHERE image_key IN (?) AND status IN ('PENDING_REVIEW', 'NEEDS_CHANGES')",
      [keys],
    );
    return new Set(rows.map((r) => r.image_key as string));
  }

  async globalProductExists(id: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT 1 FROM global_products WHERE id = ? LIMIT 1", [id]);
    return rows.length > 0;
  }

  withTransaction<T>(fn: (tx: ProductSubmissionTx) => Promise<T>): Promise<T> {
    return this.db.withTransaction((connection) => fn(this.createTx(connection)));
  }

  private createTx(connection: PoolConnection): ProductSubmissionTx {
    return {
      lockById: async (id) => {
        const [rows] = await connection.query<RowDataPacket[]>(`${SELECT_SUBMISSION} WHERE ps.id = ? FOR UPDATE OF ps`, [id]);
        return rows.length > 0 ? mapSubmission(rows[0]) : null;
      },

      lockGlobalCategory: async (id) => {
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT * FROM categories WHERE id = ? AND type = ? AND deleted_at IS NULL FOR UPDATE",
          [id, CategoryType.GLOBAL],
        );
        return rows.length > 0 ? mapCategory(rows[0]) : null;
      },

      insert: async (r) => {
        await connection
          .query(
            `INSERT INTO product_submissions
              (id, vendor_id, submitted_by_user_id, status, name, normalized_name, description, global_category_id,
               measurement_type, weight_unit, image_key, image_width, image_height, revision, vendor_acknowledged_duplicates, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              r.id,
              r.vendorId,
              r.submittedByUserId,
              r.status,
              r.name,
              r.normalizedName,
              r.description,
              r.globalCategoryId,
              r.measurementType,
              r.weightUnit,
              r.imageKey,
              r.imageWidth,
              r.imageHeight,
              r.revision,
              r.vendorAcknowledgedDuplicates,
              r.submittedAt,
            ],
          )
          .catch(mapDuplicateKey);
      },

      update: async (id, patch) => {
        const sets: string[] = [];
        const values: any[] = [];
        for (const [field, value] of Object.entries(patch)) {
          const column = COLUMN_BY_FIELD[field as keyof SubmissionPatch];
          if (!column || value === undefined) continue;
          sets.push(`${column} = ?`);
          values.push(value);
        }
        if (sets.length === 0) return;
        await connection.query(`UPDATE product_submissions SET ${sets.join(", ")} WHERE id = ?`, [...values, id]).catch(mapDuplicateKey);
      },

      addHistory: async (h) => {
        await connection.query(
          `INSERT INTO product_submission_history (id, submission_id, action, status, revision, note, actor_user_id, actor_role, snapshot, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [h.id, h.submissionId, h.action, h.status, h.revision, h.note, h.actorUserId, h.actorRole, h.snapshot ? JSON.stringify(h.snapshot) : null, h.createdAt],
        );
      },

      findCatalogCandidates: (likePatterns, globalCategoryId, limit) => findCatalogCandidates(connection, likePatterns, globalCategoryId, limit),

      findLiveGlobalProduct: async (id) => {
        const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM global_products WHERE id = ? AND deleted_at IS NULL", [id]);
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          imageUrl: row.image_url,
          globalCategoryId: row.global_category_id,
          measurementType: row.measurement_type,
          weightUnit: row.weight_unit,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      },

      insertGlobalProduct: async (p: GlobalProduct) => {
        await connection.query(
          "INSERT INTO global_products (id, name, description, image_url, global_category_id, measurement_type, weight_unit) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [p.id, p.name, p.description || null, p.imageUrl || null, p.globalCategoryId, p.measurementType, p.weightUnit || null],
        );
      },

      ensureVendorProduct: (vendorId, globalProductId) => this.vendorProductRepo.ensureVendorProduct(connection, vendorId, globalProductId),
    };
  }
}

async function findCatalogCandidates(db: Queryable, likePatterns: string[], globalCategoryId: string | null, limit: number): Promise<CatalogCandidate[]> {
  if (likePatterns.length === 0) return [];
  const conditions = [`(${likePatterns.map(() => "gp.name LIKE ?").join(" OR ")})`, "gp.deleted_at IS NULL"];
  const params: any[] = [...likePatterns];
  if (globalCategoryId) {
    conditions.push("gp.global_category_id = ?");
    params.push(globalCategoryId);
  }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT gp.id, gp.name, gp.image_url, gp.global_category_id, gp.measurement_type, gp.weight_unit, gc.name AS global_category_name
     FROM global_products gp
     LEFT JOIN categories gc ON gc.id = gp.global_category_id
     WHERE ${conditions.join(" AND ")}
     LIMIT ?`,
    [...params, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    imageUrl: row.image_url ?? null,
    globalCategoryId: row.global_category_id,
    globalCategoryName: row.global_category_name ?? null,
    measurementType: row.measurement_type,
    weightUnit: row.weight_unit ?? null,
  }));
}

function mapSubmission(row: any): ProductSubmissionRecord {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    submittedByUserId: row.submitted_by_user_id,
    status: row.status,
    name: row.name,
    normalizedName: row.normalized_name,
    description: row.description ?? null,
    globalCategoryId: row.global_category_id,
    globalCategoryName: row.global_category_name ?? null,
    measurementType: row.measurement_type,
    weightUnit: row.weight_unit ?? null,
    imageKey: row.image_key,
    imageWidth: row.image_width ?? null,
    imageHeight: row.image_height ?? null,
    revision: Number(row.revision),
    vendorAcknowledgedDuplicates: !!row.vendor_acknowledged_duplicates,
    reviewNote: row.review_note ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    resolution: row.resolution ?? null,
    reservedGlobalProductId: row.reserved_global_product_id ?? null,
    globalProductId: row.global_product_id ?? null,
    vendorProductId: row.vendor_product_id ?? null,
    publishedImageUrl: row.published_image_url ?? null,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHistory(row: any): ProductSubmissionHistoryRecord {
  let snapshot: Record<string, unknown> | null = null;
  if (row.snapshot) snapshot = typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot;
  return {
    id: row.id,
    submissionId: row.submission_id,
    action: row.action,
    status: row.status,
    revision: Number(row.revision),
    note: row.note ?? null,
    actorUserId: row.actor_user_id ?? null,
    actorRole: row.actor_role ?? null,
    snapshot,
    createdAt: row.created_at,
  };
}

function mapCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    vendorId: row.vendor_id,
    description: row.description,
    iconUrl: row.icon_url,
    color: row.color,
    createdAt: row.created_at,
  };
}
