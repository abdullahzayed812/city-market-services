import { Pool, RowDataPacket } from "mysql2/promise";
import { Product } from "../../core/entities/product.entity";
import { IProductRepository } from "../../core/interfaces/product.repository";
import { ProductFilter } from "../../core/dto/product.dto";
import { Database } from "@city-market/shared/node";

export class ProductRepository implements IProductRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(product: Product): Promise<Product> {
    const query = `
      INSERT INTO products (
        id, vendor_id, category_id, name, description, price,
        stock_quantity, image_url, is_available
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.pool.query(query, [
      product.id,
      product.vendorId,
      product.categoryId || null,
      product.name,
      product.description || null,
      product.price,
      product.stockQuantity,
      product.imageUrl || null,
      product.isAvailable,
    ]);
    return product;
  }

  async findById(id: string): Promise<Product | null> {
    const query = "SELECT * FROM products WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByVendor(vendorId: string, limit: number, offset: number): Promise<Product[]> {
    const query = `
      SELECT 
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.vendor_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [vendorId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByCategory(categoryId: string, limit: number, offset: number): Promise<Product[]> {
    const query = `
      SELECT * FROM products 
      WHERE category_id = ? AND is_available = TRUE
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [categoryId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByFilter(filter: ProductFilter, limit: number, offset: number): Promise<Product[]> {
    let query = "SELECT * FROM products WHERE 1=1";
    const params: any[] = [];

    if (filter.vendorId) {
      query += " AND vendor_id = ?";
      params.push(filter.vendorId);
    }

    if (filter.categoryId) {
      query += " AND category_id = ?";
      params.push(filter.categoryId);
    }

    if (filter.search) {
      query += " AND (name LIKE ? OR description LIKE ?)";
      const searchTerm = `%${filter.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filter.minPrice !== undefined) {
      query += " AND price >= ?";
      params.push(filter.minPrice);
    }

    if (filter.maxPrice !== undefined) {
      query += " AND price <= ?";
      params.push(filter.maxPrice);
    }

    if (filter.available !== undefined) {
      query += " AND is_available = ?";
      params.push(filter.available);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await this.pool.query<RowDataPacket[]>(query, params);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Product>): Promise<void> {
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
    if (data.price !== undefined) {
      fields.push("price = ?");
      values.push(data.price);
    }
    if (data.stockQuantity !== undefined) {
      fields.push("stock_quantity = ?");
      values.push(data.stockQuantity);
    }
    if (data.imageUrl !== undefined) {
      fields.push("image_url = ?");
      values.push(data.imageUrl);
    }
    if (data.isAvailable !== undefined) {
      fields.push("is_available = ?");
      values.push(data.isAvailable);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    const query = "UPDATE products SET stock_quantity = ? WHERE id = ?";
    await this.pool.query(query, [quantity, id]);
  }

  async decrementStock(id: string, quantity: number): Promise<void> {
    const query = "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?";
    await this.pool.execute(query, [quantity, id, quantity]);
  }

  async delete(id: string): Promise<void> {
    const query = "DELETE FROM products WHERE id = ?";
    await this.pool.execute(query, [id]);
  }

  private mapToEntity(row: any): Product {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      categoryId: row.category_id,
      categoryName: row.category_name ?? null,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      stockQuantity: row.stock_quantity,
      imageUrl: row.image_url,
      isAvailable: row.is_available,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
