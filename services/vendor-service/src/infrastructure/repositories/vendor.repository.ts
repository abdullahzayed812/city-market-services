import { Pool, RowDataPacket } from "mysql2/promise";
import { Vendor } from "../../core/entities/vendor.entity";
import { IVendorRepository } from "../../core/interfaces/vendor.repository";
import { Database } from "@city-market/shared/node";

export class VendorRepository implements IVendorRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(vendor: Vendor): Promise<Vendor> {
    const query = `
      INSERT INTO vendors (
        id, user_id, shop_name, shop_description, phone, address,
        latitude, longitude, store_image, type, status, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.pool.execute(query, [
      vendor.id,
      vendor.userId,
      vendor.shopName,
      vendor.shopDescription || null,
      vendor.phone,
      vendor.address,
      vendor.latitude || null,
      vendor.longitude || null,
      vendor.storeImage || null,
      vendor.type || null,
      vendor.status,
      vendor.isActive,
    ]);
    return vendor;
  }

  async findById(id: string): Promise<Vendor | null> {
    const query = "SELECT * FROM vendors WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Vendor[]> {
    if (!ids || ids.length === 0) return [];
    const query = `SELECT * FROM vendors WHERE id IN (?)`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [ids]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByUserId(userId: string): Promise<Vendor | null> {
    const query = "SELECT * FROM vendors WHERE user_id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [userId]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(limit: number, offset: number): Promise<Vendor[]> {
    const query = "SELECT * FROM vendors ORDER BY created_at ASC";
    const [rows] = await this.pool.query<RowDataPacket[]>(query);
    return rows.map((row) => this.mapToEntity(row));
  }

  async countAll(): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM vendors");
    return rows[0].count;
  }

  async findByStatus(status: string): Promise<Vendor[]> {
    const query = "SELECT * FROM vendors WHERE status = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [status]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Vendor>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.shopName) {
      fields.push("shop_name = ?");
      values.push(data.shopName);
    }
    if (data.shopDescription) {
      fields.push("shop_description = ?");
      values.push(data.shopDescription);
    }
    if (data.phone) {
      fields.push("phone = ?");
      values.push(data.phone);
    }
    if (data.address) {
      fields.push("address = ?");
      values.push(data.address);
    }
    if (data.latitude) {
      fields.push("latitude = ?");
      values.push(data.latitude);
    }
    if (data.longitude) {
      fields.push("longitude = ?");
      values.push(data.longitude);
    }
    if (data.storeImage) {
      fields.push("store_image = ?");
      values.push(data.storeImage);
    }
    if (data.type) {
      fields.push("type = ?");
      values.push(data.type);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE vendors SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const query = "UPDATE vendors SET status = ? WHERE id = ?";
    await this.pool.execute(query, [status, id]);
  }

  async updateRating(id: string, averageRating: number, totalRatings: number): Promise<void> {
    const query = "UPDATE vendors SET average_rating = ?, total_ratings = ? WHERE id = ?";
    await this.pool.execute(query, [averageRating, totalRatings, id]);
  }

  private mapToEntity(row: any): Vendor {
    return {
      id: row.id,
      userId: row.user_id,
      shopName: row.shop_name,
      shopDescription: row.shop_description,
      phone: row.phone,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      storeImage: row.store_image,
      type: row.type,
      status: row.status,
      averageRating: row.average_rating ? parseFloat(row.average_rating) : 0,
      totalRatings: row.total_ratings || 0,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
