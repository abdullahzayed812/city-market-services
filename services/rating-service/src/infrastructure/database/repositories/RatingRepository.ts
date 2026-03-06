import { PoolConnection } from "mysql2/promise";
import { Database } from "@city-market/shared/node";
import { IRatingRepository } from "../../../core/interfaces/IRatingRepository";
import { Rating } from "../../../core/entities/Rating";

export class RatingRepository implements IRatingRepository {
  constructor(private db: Database) {}

  async create(rating: Rating, connection?: PoolConnection): Promise<Rating> {
    const sql = `
            INSERT INTO ratings (id, order_id, vendor_id, customer_id, stars, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
    const values = [
      rating.id,
      rating.orderId,
      rating.vendorId,
      rating.customerUserId,
      rating.stars,
      rating.comment || null,
      rating.createdAt,
    ];

    if (connection) {
      await connection.query(sql, values);
    } else {
      await this.db.getPool().query(sql, values);
    }

    return rating;
  }

  async findByOrderId(orderId: string): Promise<Rating | null> {
    const sql = "SELECT * FROM ratings WHERE order_id = ?";
    const [rows]: any = await this.db.getPool().query(sql, [orderId]);
    if (rows.length === 0) return null;
    return this.mapToEntity(rows[0]);
  }

  async findByOrderAndVendor(orderId: string, vendorId: string): Promise<Rating | null> {
    const sql = "SELECT * FROM ratings WHERE order_id = ? AND vendor_id = ?";
    const [rows]: any = await this.db.getPool().query(sql, [orderId, vendorId]);
    if (rows.length === 0) return null;
    return this.mapToEntity(rows[0]);
  }

  async findByVendorId(vendorId: string, limit: number, offset: number): Promise<Rating[]> {
    const sql = "SELECT * FROM ratings WHERE vendor_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const [rows]: any = await this.db.getPool().query(sql, [vendorId, limit, offset]);
    return rows.map(this.mapToEntity);
  }

  private mapToEntity(row: any): Rating {
    return {
      id: row.id,
      orderId: row.order_id,
      vendorId: row.vendor_id,
      customerUserId: row.customer_id,
      stars: row.stars,
      comment: row.comment,
      createdAt: new Date(row.created_at),
    };
  }
}
