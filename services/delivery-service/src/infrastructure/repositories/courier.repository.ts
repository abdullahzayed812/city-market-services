import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
import { Courier } from "../../core/entities/courier.entity";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { Database } from "@city-market/shared";

export class CourierRepository implements ICourierRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(courier: Courier, connection?: PoolConnection): Promise<Courier> {
    const conn = connection || this.pool;
    const query = `
      INSERT INTO couriers (
        id, user_id, full_name, phone, vehicle_type, license_plate,
        is_available, is_active, rating, total_deliveries
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.execute(query, [
      courier.id,
      courier.userId,
      courier.fullName,
      courier.phone,
      courier.vehicleType || null,
      courier.licensePlate || null,
      courier.isAvailable,
      courier.isActive,
      courier.rating,
      courier.totalDeliveries,
    ]);
    return courier;
  }

  async findById(id: string, connection?: PoolConnection): Promise<Courier | null> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM couriers WHERE id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByUserId(userId: string, connection?: PoolConnection): Promise<Courier | null> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM couriers WHERE user_id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [userId]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAvailable(connection?: PoolConnection): Promise<Courier[]> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM couriers WHERE is_available = TRUE AND is_active = TRUE";
    const [rows] = await conn.execute<RowDataPacket[]>(query);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findAll(limit: number, offset: number, connection?: PoolConnection): Promise<Courier[]> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM couriers ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const [rows] = await conn.query<RowDataPacket[]>(query, [limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Courier>, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const fields: string[] = [];
    const values: any[] = [];

    if (data.fullName) {
      fields.push("full_name = ?");
      values.push(data.fullName);
    }
    if (data.phone) {
      fields.push("phone = ?");
      values.push(data.phone);
    }
    if (data.vehicleType !== undefined) {
      fields.push("vehicle_type = ?");
      values.push(data.vehicleType);
    }
    if (data.licensePlate !== undefined) {
      fields.push("license_plate = ?");
      values.push(data.licensePlate);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE couriers SET ${fields.join(", ")} WHERE id = ?`;
    await conn.execute(query, values);
  }

  async updateAvailability(id: string, isAvailable: boolean, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const query = "UPDATE couriers SET is_available = ? WHERE id = ?";
    await conn.query(query, [isAvailable, id]);
  }

  async incrementDeliveries(id: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const query = "UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE id = ?";
    await conn.execute(query, [id]);
  }

  private mapToEntity(row: any): Courier {
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      vehicleType: row.vehicle_type,
      licensePlate: row.license_plate,
      isAvailable: row.is_available,
      isActive: row.is_active,
      rating: parseFloat(row.rating),
      totalDeliveries: row.total_deliveries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
