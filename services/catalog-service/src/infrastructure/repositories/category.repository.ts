import { Pool, RowDataPacket } from "mysql2/promise";
import { Category } from "../../core/entities/category.entity";
import { ICategoryRepository } from "../../core/interfaces/category.repository";
import { Database } from "@city-market/shared/node";

export class CategoryRepository implements ICategoryRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(category: Category): Promise<Category> {
    const query = "INSERT INTO categories (id, name, description) VALUES (?, ?, ?)";
    await this.pool.execute(query, [category.id, category.name, category.description || null]);
    return category;
  }

  async findById(id: string): Promise<Category | null> {
    const query = "SELECT * FROM categories WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(): Promise<Category[]> {
    const query = "SELECT * FROM categories ORDER BY name";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Category>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push("description = ?");
      values.push(data.description);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async delete(id: string): Promise<void> {
    const query = "DELETE FROM categories WHERE id = ?";
    await this.pool.execute(query, [id]);
  }

  private mapToEntity(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
    };
  }
}
