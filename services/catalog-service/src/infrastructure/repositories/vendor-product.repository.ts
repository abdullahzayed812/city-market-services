import { randomUUID } from "crypto";
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
      "INSERT INTO vendor_products (id, vendor_id, global_product_id, vendor_category_id, price, stock_quantity, stock_weight_grams, reserved_weight_grams, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    await this.pool.execute(query, [
      product.id,
      product.vendorId,
      product.globalProductId,
      product.vendorCategoryId,
      product.price,
      product.stockQuantity,
      product.stockWeightGrams || 0,
      product.reservedWeightGrams || 0,
      product.isAvailable,
    ]);
    return product;
  }

  async findById(id: string): Promise<VendorProduct | null> {
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, gp.measurement_type, gp.weight_unit, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      WHERE vp.id = ? AND vp.deleted_at IS NULL`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(limit: number, offset: number): Promise<VendorProduct[]> {
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, gp.measurement_type, gp.weight_unit, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      WHERE vp.deleted_at IS NULL
      ORDER BY vp.created_at DESC, vp.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async countAll(): Promise<number> {
    const query = "SELECT COUNT(*) as count FROM vendor_products WHERE deleted_at IS NULL";
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
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, gp.measurement_type, gp.weight_unit, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      WHERE vp.vendor_id = ? AND vp.deleted_at IS NULL
      ORDER BY vp.created_at DESC, vp.id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [vendorId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByCategory(categoryId: string, limit: number, offset: number): Promise<VendorProduct[]> {
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, gp.measurement_type, gp.weight_unit, 
             gc.name as global_category_name, vc.name as vendor_category_name 
      FROM vendor_products vp
      JOIN global_products gp ON vp.global_product_id = gp.id
      LEFT JOIN categories gc ON gp.global_category_id = gc.id
      LEFT JOIN categories vc ON vp.vendor_category_id = vc.id
      WHERE (gp.global_category_id = ? OR vp.vendor_category_id = ?) AND vp.deleted_at IS NULL
      ORDER BY vp.created_at DESC, vp.id DESC 
      LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [categoryId, categoryId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByFilter(filter: VendorProductFilter, limit: number, offset: number): Promise<VendorProduct[]> {
    const { whereClause, values } = this.buildFilterQuery(filter);
    const query = `
      SELECT vp.*, gp.name, gp.description, gp.image_url, gp.global_category_id, gp.measurement_type, gp.weight_unit, 
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
      stockWeightGrams: "stock_weight_grams",
      reservedQuantity: "reserved_quantity",
      reservedWeightGrams: "reserved_weight_grams",
      isAvailable: "is_available",

      vendorCategoryId: "vendor_category_id",
      globalProductId: "global_product_id",
    };

    for (const [key, value] of Object.entries(data)) {
      if (fieldMap[key] && value !== undefined) {
        fields.push(`${fieldMap[key]} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE vendor_products SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async updateStock(id: string, quantity: number, updateAvailability = true): Promise<void> {
    if (updateAvailability) {
      const query = "UPDATE vendor_products SET stock_quantity = ?, is_available = ? WHERE id = ?";
      await this.pool.execute(query, [quantity, quantity > 0, id]);
    } else {
      const query = "UPDATE vendor_products SET stock_quantity = ? WHERE id = ?";
      await this.pool.execute(query, [quantity, id]);
    }
  }

  async updateWeightStock(id: string, weight: number, updateAvailability = true): Promise<void> {
    if (updateAvailability) {
      const query = "UPDATE vendor_products SET stock_weight_grams = ?, is_available = ? WHERE id = ?";
      await this.pool.execute(query, [weight, weight > 0, id]);
    } else {
      const query = "UPDATE vendor_products SET stock_weight_grams = ? WHERE id = ?";
      await this.pool.execute(query, [weight, id]);
    }
  }

  async updatePrice(id: string, price: number): Promise<void> {
    const query = "UPDATE vendor_products SET price = ? WHERE id = ?";
    await this.pool.execute(query, [price, id]);
  }

  async decrementStock(id: string, quantity: number): Promise<void> {
    const query = "UPDATE vendor_products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?";
    const [result] = await this.pool.execute<ResultSetHeader>(query, [quantity, id, quantity]);
    if (result.affectedRows === 0) {
      throw new Error("Insufficient stock or product not found");
    }
  }

  async decrementWeightStock(id: string, weight: number): Promise<void> {
    const query = "UPDATE vendor_products SET stock_weight_grams = stock_weight_grams - ? WHERE id = ? AND stock_weight_grams >= ?";
    const [result] = await this.pool.execute<ResultSetHeader>(query, [weight, id, weight]);
    if (result.affectedRows === 0) {
      throw new Error("Insufficient stock or product not found");
    }
  }

  async reserveWeightStock(id: string, weight: number): Promise<void> {
    const query =
      "UPDATE vendor_products SET reserved_weight_grams = reserved_weight_grams + ? WHERE id = ? AND (stock_weight_grams - reserved_weight_grams) >= ?";
    const [result] = await this.pool.execute<ResultSetHeader>(query, [weight, id, weight]);
    if (result.affectedRows === 0) {
      throw new Error("Insufficient available weight or product not found");
    }
  }

  async releaseWeightStock(id: string, weight: number): Promise<void> {
    const query = "UPDATE vendor_products SET reserved_weight_grams = reserved_weight_grams - ? WHERE id = ? AND reserved_weight_grams >= ?";
    const [result] = await this.pool.execute<ResultSetHeader>(query, [weight, id, weight]);
    if (result.affectedRows === 0) {
      throw new Error("Reservation error: not enough reserved weight or product not found");
    }
  }

  async commitWeightStock(id: string, actualWeight: number, reservedWeight: number): Promise<void> {
    const query =
      "UPDATE vendor_products SET stock_weight_grams = stock_weight_grams - ?, reserved_weight_grams = reserved_weight_grams - ? WHERE id = ? AND stock_weight_grams >= ? AND reserved_weight_grams >= ?";
    const [result] = await this.pool.execute<ResultSetHeader>(query, [actualWeight, reservedWeight, id, actualWeight, reservedWeight]);
    if (result.affectedRows === 0) {
      throw new Error("Commit error: insufficient stock or reserved weight");
    }
  }

  async reserveStock(id: string, quantity: number, weightGrams: number): Promise<boolean> {
    const query = `
      UPDATE vendor_products
      SET 
        reserved_quantity = reserved_quantity + ?,
        reserved_weight_grams = reserved_weight_grams + ?
      WHERE 
        id = ?
        AND is_available = TRUE 
        AND (stock_quantity - reserved_quantity) >= ?
        AND (stock_weight_grams - reserved_weight_grams) >= ?`;

    const [result] = await this.pool.execute<ResultSetHeader>(query, [quantity, weightGrams, id, quantity, weightGrams]);

    return result.affectedRows > 0;
  }

  async releaseStock(id: string, quantity: number, weightGrams: number): Promise<void> {
    const query = `
      UPDATE vendor_products
      SET
        reserved_quantity = GREATEST(0, reserved_quantity - ?),
        reserved_weight_grams = GREATEST(0, reserved_weight_grams - ?)
      WHERE id = ?`;
    await this.pool.execute(query, [quantity ?? 0, weightGrams ?? 0, id]);
  }

  async commitStock(id: string, quantity: number, actualWeightGrams: number, reservedWeightGrams: number): Promise<void> {
    const query = `
      UPDATE vendor_products
      SET 
        stock_quantity = GREATEST(0, stock_quantity - ?),
        stock_weight_grams = GREATEST(0, stock_weight_grams - ?),
        reserved_quantity = GREATEST(0, reserved_quantity - ?),
        reserved_weight_grams = GREATEST(0, reserved_weight_grams - ?)
      WHERE id = ?`;
    await this.pool.execute(query, [quantity, actualWeightGrams, quantity, reservedWeightGrams, id]);
  }

  async delete(id: string): Promise<void> {
    const query = "UPDATE vendor_products SET deleted_at = NOW() WHERE id = ?";
    await this.pool.execute(query, [id]);
  }

  async bulkAddFromGlobalProducts(
    vendorId: string,
    items: Array<{ globalProductId: string; price?: number; stockQuantity?: number; stockWeightGrams?: number; vendorCategoryId?: string }>,
  ): Promise<{ addedIds: string[]; skippedIds: string[] }> {
    if (items.length === 0) {
      return { addedIds: [], skippedIds: [] };
    }

    const globalProductIds = items.map((item) => item.globalProductId);

    return this.db.withTransaction(async (connection) => {
      const [globalRows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM global_products WHERE id IN (?) AND deleted_at IS NULL",
        [globalProductIds],
      );
      const validGlobalIds = new Set(globalRows.map((row) => row.id));

      const [existingRows] = await connection.query<RowDataPacket[]>(
        "SELECT global_product_id FROM vendor_products WHERE vendor_id = ? AND global_product_id IN (?) AND deleted_at IS NULL",
        [vendorId, globalProductIds],
      );
      const existingIds = new Set(existingRows.map((row) => row.global_product_id));

      const toInsert = items.filter((item) => validGlobalIds.has(item.globalProductId) && !existingIds.has(item.globalProductId));
      const addedIds = toInsert.map((item) => item.globalProductId);
      const skippedIds = globalProductIds.filter((id) => !addedIds.includes(id));

      if (toInsert.length === 0) {
        return { addedIds, skippedIds };
      }

      const values = toInsert.map((item) => {
        const price = item.price ?? 0;
        const stockQuantity = item.stockQuantity ?? 0;
        const stockWeightGrams = item.stockWeightGrams ?? 0;
        const isAvailable = stockQuantity > 0 || stockWeightGrams > 0;
        return [randomUUID(), vendorId, item.globalProductId, item.vendorCategoryId ?? null, price, stockQuantity, stockWeightGrams, 0, isAvailable];
      });
      await connection.query(
        `INSERT INTO vendor_products
          (id, vendor_id, global_product_id, vendor_category_id, price, stock_quantity, stock_weight_grams, reserved_weight_grams, is_available)
         VALUES ?`,
        [values],
      );

      return { addedIds, skippedIds };
    });
  }

  private buildFilterQuery(filter: VendorProductFilter): { whereClause: string; values: any[] } {
    const conditions: string[] = ["vp.deleted_at IS NULL"];
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
    if (filter.available) {
      conditions.push("vp.is_available = ?");
      values.push(filter.available);
    }
    if (filter.search) {
      conditions.push("gp.name LIKE ?");
      values.push(`%${filter.search}%`);
    }
    if (filter.minPrice) {
      conditions.push("vp.price >= ?");
      values.push(filter.minPrice);
    }
    if (filter.maxPrice) {
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
      stockWeightGrams: row.stock_weight_grams,
      reservedQuantity: row.reserved_quantity,
      reservedWeightGrams: row.reserved_weight_grams,
      measurementType: row.measurement_type,
      weightUnit: row.weight_unit,
      imageUrl: row.image_url,
      isAvailable: Boolean(row.is_available),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as any;
  }
}
