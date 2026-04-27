import { Pool, PoolConnection } from "mysql2/promise";
import { DeliveryOffice } from "../../core/entities/delivery-office.entity";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { Database } from "@city-market/shared/node";

export class DeliveryOfficeRepository implements IDeliveryOfficeRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async findById(id: string, connection?: PoolConnection): Promise<DeliveryOffice | null> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).execute(
      "SELECT * FROM delivery_offices WHERE id = ?",
      [id],
    );
    return (rows as any[]).length > 0 ? this.mapToEntity((rows as any[])[0]) : null;
  }

  async findAll(limit: number, offset: number, connection?: PoolConnection): Promise<DeliveryOffice[]> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).query(
      "SELECT * FROM delivery_offices ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
    return (rows as any[]).map((r: any) => this.mapToEntity(r));
  }

  async findByUserId(userId: string, connection?: PoolConnection): Promise<DeliveryOffice | null> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).execute(
      "SELECT * FROM delivery_offices WHERE user_id = ?",
      [userId],
    );
    return (rows as any[]).length > 0 ? this.mapToEntity((rows as any[])[0]) : null;
  }

  private mapToEntity(row: any): DeliveryOffice {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
