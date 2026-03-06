import { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { VendorProduct } from "../../core/entities/vendor-product.entity";
import { IVendorProductRepository } from "../../core/interfaces/vendor-product.repository";
import { VendorProductFilter } from "../../core/dto/vendor-product.dto";
import { Database } from "@city-market/shared/node";

export class VendorProductRepository implements IVendorProductRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(product: VendorProduct): Promise<VendorProduct> {
    const query =
      "INSERT INTO vendor_products (id, vendor_id, global_product_id, vendor_category_id, price, stock_quantity, is_available) VALUES (?, ?, ?, ?, ?, ?, ?)";
    await this.pool.execute(query, [
      product.id,
      product.vendorId,
      product.globalProductId,
      product.vendorCategoryId,
      product.price,
      product.stockQuantity,
      product.isAvailable,
    ]);
    return product;
  }

  async findById(id: string): Promise<VendorProduct | null> {
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      WHERE vp.id = ?`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(limit: number, offset: number): Promise<VendorProduct[]> {
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      ORDER BY vp.created_at DESC, vp.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async countAll(): Promise<number> {
    const query = "SELECT COUNT(*) as count FROM vendor_products";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query);
    return rows[0].count;
  }

  async countByFilter(filter: VendorProductFilter): Promise<number> {
    const { whereClause, values } = this.buildFilterQuery(filter);
    const query = `
      SELECT COUNT(*) as count 
      FROM vendor_products vp 
      JOIN global_products gp ON vp.global_product_id = gp.id
      ${whereClause}`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, values);
    return rows[0].count;
  }

  async findByVendor(vendorId: string, limit: number, offset: number): Promise<VendorProduct[]> {
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      WHERE vp.vendor_id = ?
      ORDER BY vp.created_at DESC, vp.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [vendorId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByCategory(categoryId: string, limit: number, offset: number): Promise<VendorProduct[]> {
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      WHERE gp.global_category_id = ? OR vp.vendor_category_id = ?
      ORDER BY vp.created_at DESC, vp.id DESC 
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [categoryId, categoryId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByFilter(filter: VendorProductFilter, limit: number, offset: number): Promise<VendorProduct[]> {
    const { whereClause, values } = this.buildFilterQuery(filter);
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      ${whereClause}
      ORDER BY vp.created_at DESC, vp.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [...values, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<VendorProduct>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, string> = {
      price: "price",
      stockQuantity: "stock_quantity",
      isAvailable: "is_available",
      vendorCategoryId: "vendor_category_id",
      globalProductId: "global_product_id",
    };

    for (const [key, value] of Object.entries(data)) {
      if (fieldMap[key] !== undefined && value !== undefined) {
        fields.push(`${fieldMap[key]} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE vendor_products SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    const query = "UPDATE vendor_products SET stock_quantity = ? WHERE id = ?";
    await this.pool.execute(query, [quantity, id]);
  }

  async decrementStock(id: string, quantity: number): Promise<void> {
    const query = "UPDATE vendor_products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?";
    const [result] = await this.pool.execute<ResultSetHeader>(query, [quantity, id, quantity]);
    if (result.affectedRows === 0) {
      throw new Error("Insufficient stock or product not found");
    }
  }

  async delete(id: string): Promise<void> {
    const query = "DELETE FROM vendor_products WHERE id = ?";
    await this.pool.execute(query, [id]);
  }

  private buildFilterQuery(filter: VendorProductFilter): { whereClause: string; values: any[] } {
    const conditions: string[] = ["1=1"];
    const values: any[] = [];

    if (filter.vendorId) {
      conditions.push("vp.vendor_id = ?");
      values.push(filter.vendorId);
    }
    if (filter.globalCategoryId) {
      conditions.push("gp.global_category_id = ?");
      values.push(filter.globalCategoryId);
    }
    if (filter.vendorCategoryId) {
      conditions.push("vp.vendor_category_id = ?");
      values.push(filter.vendorCategoryId);
    }
    if (filter.available !== undefined) {
      conditions.push("vp.is_available = ?");
      values.push(filter.available);
    }
    if (filter.search) {
      conditions.push("gp.name LIKE ?");
      values.push(`%${filter.search}%`);
    }
    if (filter.minPrice !== undefined) {
      conditions.push("vp.price >= ?");
      values.push(filter.minPrice);
    }
    if (filter.maxPrice !== undefined) {
      conditions.push("vp.price <= ?");
      values.push(filter.maxPrice);
    }

    return {
      whereClause: `WHERE ${conditions.join(" AND ")}`,
      values,
    };
  }

  private mapToEntity(row: any): VendorProduct {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      globalProductId: row.global_product_id,
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
