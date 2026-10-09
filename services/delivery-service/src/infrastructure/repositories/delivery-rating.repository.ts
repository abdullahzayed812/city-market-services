import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { Database } from "@city-market/shared/node";
import { DeliveryRating } from "../../core/entities/delivery-rating.entity";
import {
  DeliveryRatingFilter,
  DeliveryRatingSummary,
  DeliveryRatingView,
  IDeliveryRatingRepository,
} from "../../core/interfaces/delivery-rating.repository";

export class DeliveryRatingRepository implements IDeliveryRatingRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(rating: DeliveryRating, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.execute(
      `INSERT INTO delivery_ratings (id, delivery_id, customer_order_id, customer_id, courier_id, delivery_office_id, stars, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rating.id, rating.deliveryId, rating.customerOrderId, rating.customerId, rating.courierId, rating.deliveryOfficeId, rating.stars, rating.comment],
    );
  }

  async findByDeliveryId(deliveryId: string, connection?: PoolConnection): Promise<DeliveryRating | null> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>("SELECT * FROM delivery_ratings WHERE delivery_id = ?", [deliveryId]);
    return rows.length ? this.mapToEntity(rows[0]) : null;
  }

  async findByDeliveryIds(deliveryIds: string[]): Promise<DeliveryRating[]> {
    if (deliveryIds.length === 0) return [];
    const placeholders = deliveryIds.map(() => "?").join(", ");
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM delivery_ratings WHERE delivery_id IN (${placeholders})`, deliveryIds);
    return rows.map((row) => this.mapToEntity(row));
  }

  private where(filter: DeliveryRatingFilter): { clause: string; params: string[] } {
    const parts: string[] = [];
    const params: string[] = [];
    if (filter.courierId) {
      parts.push("r.courier_id = ?");
      params.push(filter.courierId);
    }
    if (filter.deliveryOfficeId) {
      parts.push("r.delivery_office_id = ?");
      params.push(filter.deliveryOfficeId);
    }
    return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
  }

  async list(filter: DeliveryRatingFilter, limit: number, offset: number): Promise<DeliveryRatingView[]> {
    const { clause, params } = this.where(filter);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.*, c.full_name AS courier_name, o.name AS office_name
         FROM delivery_ratings r
         LEFT JOIN couriers c ON c.id = r.courier_id
         LEFT JOIN delivery_offices o ON o.id = r.delivery_office_id
         ${clause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map((row) => ({ ...this.mapToEntity(row), courierName: row.courier_name ?? null, officeName: row.office_name ?? null }));
  }

  async summary(filter: DeliveryRatingFilter): Promise<DeliveryRatingSummary> {
    const { clause, params } = this.where(filter);
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT r.stars, COUNT(*) AS n FROM delivery_ratings r ${clause} GROUP BY r.stars`, params);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as DeliveryRatingSummary["distribution"];
    let total = 0;
    let sum = 0;
    for (const row of rows) {
      const stars = Number(row.stars) as 1 | 2 | 3 | 4 | 5;
      const n = Number(row.n);
      distribution[stars] = n;
      total += n;
      sum += stars * n;
    }
    return { averageRating: total ? Number((sum / total).toFixed(2)) : null, totalRatings: total, distribution };
  }

  // Recomputed from the ratings table (not incremented) so the stored value can't drift.
  async refreshCourierRating(courierId: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.execute(
      `UPDATE couriers c
          JOIN (SELECT COUNT(*) AS n, ROUND(AVG(stars), 2) AS avg_stars FROM delivery_ratings WHERE courier_id = ?) r
          SET c.rating = r.avg_stars, c.rating_count = r.n
        WHERE c.id = ? AND r.n > 0`,
      [courierId, courierId],
    );
  }

  async refreshOfficeRating(officeId: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.execute(
      `UPDATE delivery_offices o
          JOIN (SELECT COUNT(*) AS n, ROUND(AVG(stars), 2) AS avg_stars FROM delivery_ratings WHERE delivery_office_id = ?) r
          SET o.rating = r.avg_stars, o.rating_count = r.n
        WHERE o.id = ? AND r.n > 0`,
      [officeId, officeId],
    );
  }

  private mapToEntity(row: any): DeliveryRating {
    return {
      id: row.id,
      deliveryId: row.delivery_id,
      customerOrderId: row.customer_order_id,
      customerId: row.customer_id,
      courierId: row.courier_id,
      deliveryOfficeId: row.delivery_office_id ?? null,
      stars: Number(row.stars),
      comment: row.comment ?? null,
      createdAt: row.created_at,
    };
  }
}
