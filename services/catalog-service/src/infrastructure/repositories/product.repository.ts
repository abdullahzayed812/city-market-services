import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
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
    const query =
      "INSERT INTO products (id, vendor_id, global_category_id, vendor_category_id, name, description, price, stock_quantity, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    await this.pool.execute(query, [
      product.id,
      product.vendorId,
      product.globalCategoryId,
      product.vendorCategoryId,
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
    const query = `
      SELECT p.*, gc.name as global_category_name, vc.name as vendor_category_name 
      FROM products p
      LEFT JOIN categories gc ON p.global_category_id = gc.id
      LEFT JOIN categories vc ON p.vendor_category_id = vc.id
      WHERE p.id = ?`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(limit: number, offset: number): Promise<Product[]> {
    const query = `
      SELECT p.*, gc.name as global_category_name, vc.name as vendor_category_name 
      FROM products p
      LEFT JOIN categories gc ON p.global_category_id = gc.id
      LEFT JOIN categories vc ON p.vendor_category_id = vc.id
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async countAll(): Promise<number> {
    const query = "SELECT COUNT(*) as count FROM products";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query);
    return rows[0].count;
  }

  async countByFilter(filter: ProductFilter): Promise<number> {
    const { whereClause, values } = this.buildFilterQuery(filter);
    const query = `SELECT COUNT(*) as count FROM products p ${whereClause}`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, values);
    return rows[0].count;
  }

  async findByVendor(vendorId: string, limit: number, offset: number): Promise<Product[]> {
    const query = `
      SELECT p.*, gc.name as global_category_name, vc.name as vendor_category_name 
      FROM products p
      LEFT JOIN categories gc ON p.global_category_id = gc.id
      LEFT JOIN categories vc ON p.vendor_category_id = vc.id
      WHERE p.vendor_id = ?
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [vendorId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByCategory(categoryId: string, limit: number, offset: number): Promise<Product[]> {
    // This is tricky: categoryId could be either global or vendor.
    // We search both for compatibility if only one categoryId is provided.
    const query = `
      SELECT p.*, gc.name as global_category_name, vc.name as vendor_category_name 
      FROM products p
      LEFT JOIN categories gc ON p.global_category_id = gc.id
      LEFT JOIN categories vc ON p.vendor_category_id = vc.id
      WHERE p.global_category_id = ? OR p.vendor_category_id = ?
      ORDER BY p.created_at DESC, p.id DESC 
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [categoryId, categoryId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByFilter(filter: ProductFilter, limit: number, offset: number): Promise<Product[]> {
    const { whereClause, values } = this.buildFilterQuery(filter);
    const query = `
      SELECT p.*, gc.name as global_category_name, vc.name as vendor_category_name 
      FROM products p
      LEFT JOIN categories gc ON p.global_category_id = gc.id
      LEFT JOIN categories vc ON p.vendor_category_id = vc.id
      ${whereClause}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [...values, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Product>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      name: "name",
      description: "description",
      price: "price",
      stockQuantity: "stock_quantity",
      imageUrl: "image_url",
      isAvailable: "is_available",
      globalCategoryId: "global_category_id",
      vendorCategoryId: "vendor_category_id",
    };

    for (const [key, value] of Object.entries(data)) {
      if (fieldMap[key] !== undefined && value !== undefined) {
        fields.push(`${fieldMap[key]} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    const query = "UPDATE products SET stock_quantity = ? WHERE id = ?";
    await this.pool.execute(query, [quantity, id]);
  }

  async decrementStock(id: string, quantity: number): Promise<void> {
    const query = "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?";
    const [result] = await this.pool.execute<ResultSetHeader>(query, [quantity, id, quantity]);
    if (result.affectedRows === 0) {
      throw new Error("Insufficient stock or product not found");
    }
  }

  async delete(id: string): Promise<void> {
    const query = "DELETE FROM products WHERE id = ?";
    await this.pool.execute(query, [id]);
  }

  private buildFilterQuery(filter: ProductFilter): { whereClause: string; values: any[] } {
    const conditions: string[] = ["1=1"];
    const values: any[] = [];

    if (filter.vendorId) {
      conditions.push("p.vendor_id = ?");
      values.push(filter.vendorId);
    }
    if (filter.globalCategoryId) {
      conditions.push("p.global_category_id = ?");
      values.push(filter.globalCategoryId);
    }
    if (filter.vendorCategoryId) {
      conditions.push("p.vendor_category_id = ?");
      values.push(filter.vendorCategoryId);
    }
    if (filter.available !== undefined) {
      conditions.push("p.is_available = ?");
      values.push(filter.available);
    }
    if (filter.search) {
      conditions.push("p.name LIKE ?");
      values.push(`%${filter.search}%`);
    }
    if (filter.minPrice !== undefined) {
      conditions.push("p.price >= ?");
      values.push(filter.minPrice);
    }
    if (filter.maxPrice !== undefined) {
      conditions.push("p.price <= ?");
      values.push(filter.maxPrice);
    }

    return {
      whereClause: `WHERE ${conditions.join(" AND ")}`,
      values,
    };
  }

  private mapToEntity(row: any): Product {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      globalCategoryId: row.global_category_id,
      vendorCategoryId: row.vendor_category_id,
      globalCategoryName: row.global_category_name,
      vendorCategoryName: row.vendor_category_name,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      stockQuantity: row.stock_quantity,
      imageUrl: row.image_url,
      isAvailable: Boolean(row.is_available),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
