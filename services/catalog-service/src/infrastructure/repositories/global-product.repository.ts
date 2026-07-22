import { Pool, RowDataPacket } from "mysql2/promise";
import { GlobalProduct } from "../../core/entities/global-product.entity";
import { IGlobalProductRepository } from "../../core/interfaces/global-product.repository";
import { Database } from "@city-market/shared/node";

export class GlobalProductRepository implements IGlobalProductRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(product: GlobalProduct): Promise<GlobalProduct> {
    const query =
      "INSERT INTO global_products (id, name, description, image_url, global_category_id, measurement_type, weight_unit) VALUES (?, ?, ?, ?, ?, ?, ?)";
    await this.pool.execute(query, [
      product.id,
      product.name,
      product.description || null,
      product.imageUrl || null,
      product.globalCategoryId,
      product.measurementType || "UNIT",
      product.weightUnit || null,
    ]);
    return product;
  }

  async findById(id: string): Promise<GlobalProduct | null> {
    const query = "SELECT * FROM global_products WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(limit: number, offset: number, search?: string, globalCategoryId?: string): Promise<GlobalProduct[]> {
    let query = "SELECT * FROM global_products";
    const conditions: string[] = [];
    const params: any[] = [];
    if (search) {
      conditions.push("name LIKE ?");
      params.push(`%${search}%`);
    }
    if (globalCategoryId) {
      conditions.push("global_category_id = ?");
      params.push(globalCategoryId);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const [rows] = await this.pool.query<RowDataPacket[]>(query, params);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findAllByCategory(globalCategoryId: string): Promise<GlobalProduct[]> {
    const query = "SELECT * FROM global_products WHERE global_category_id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [globalCategoryId]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<GlobalProduct>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      name: "name",
      description: "description",
      imageUrl: "image_url",
      globalCategoryId: "global_category_id",
      measurementType: "measurement_type",
      weightUnit: "weight_unit",
    };

    for (const [key, value] of Object.entries(data)) {
      if (fieldMap[key] && value) {
        fields.push(`${fieldMap[key]} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE global_products SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async delete(id: string): Promise<void> {
    const query = "DELETE FROM global_products WHERE id = ?";
    await this.pool.execute(query, [id]);
  }

  async count(search?: string, globalCategoryId?: string): Promise<number> {
    let query = "SELECT COUNT(*) as count FROM global_products";
    const conditions: string[] = [];
    const params: any[] = [];
    if (search) {
      conditions.push("name LIKE ?");
      params.push(`%${search}%`);
    }
    if (globalCategoryId) {
      conditions.push("global_category_id = ?");
      params.push(globalCategoryId);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, params);
    return rows[0].count;
  }

  private mapToEntity(row: any): GlobalProduct {
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
  }
}
