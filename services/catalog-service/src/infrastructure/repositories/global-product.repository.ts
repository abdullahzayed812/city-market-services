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
      "INSERT INTO global_products (id, name, description, image_url, global_category_id) VALUES (?, ?, ?, ?, ?)";
    await this.pool.execute(query, [
      product.id,
      product.name,
      product.description || null,
      product.imageUrl || null,
      product.globalCategoryId,
    ]);
    return product;
  }

  async findById(id: string): Promise<GlobalProduct | null> {
    const query = "SELECT * FROM global_products WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(limit: number, offset: number): Promise<GlobalProduct[]> {
    const query = "SELECT * FROM global_products LIMIT ? OFFSET ?";
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [limit, offset]);
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
    };

    for (const [key, value] of Object.entries(data)) {
      if (fieldMap[key] !== undefined && value !== undefined) {
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

  async count(): Promise<number> {
    const query = "SELECT COUNT(*) as count FROM global_products";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query);
    return rows[0].count;
  }

  private mapToEntity(row: any): GlobalProduct {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      globalCategoryId: row.global_category_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
