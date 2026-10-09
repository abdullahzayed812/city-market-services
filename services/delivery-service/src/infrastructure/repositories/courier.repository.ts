import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
import { Courier, CourierApprovalStatus, CourierType } from "../../core/entities/courier.entity";
import { CourierListFilter, ICourierRepository } from "../../core/interfaces/courier.repository";
import { Database } from "@city-market/shared/node";

export class CourierRepository implements ICourierRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(courier: Courier, connection?: PoolConnection): Promise<Courier> {
    const conn = connection || this.pool;
    const query = `
      INSERT INTO couriers (
        id, user_id, delivery_office_id, courier_type, approval_status, national_id_url, license_url,
        full_name, phone, vehicle_type, license_plate, is_available, is_active, rating, total_deliveries
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.execute(query, [
      courier.id,
      courier.userId,
      courier.deliveryOfficeId || null,
      courier.courierType,
      courier.approvalStatus,
      courier.nationalIdUrl || null,
      courier.licenseUrl || null,
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

  // Must run inside a transaction; holds the row until commit so two
  // assignments/claims can't both take the same courier.
  async findByIdForUpdate(id: string, connection: PoolConnection): Promise<Courier | null> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT * FROM couriers WHERE id = ? FOR UPDATE", [id]);
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
    const query = "SELECT * FROM couriers WHERE is_available = TRUE AND is_active = TRUE AND approval_status = 'APPROVED'";
    const [rows] = await conn.execute<RowDataPacket[]>(query);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findAll(limit: number, offset: number, filter: CourierListFilter = {}, connection?: PoolConnection): Promise<Courier[]> {
    const conn = connection || this.pool;
    const { where, params } = this.buildFilter(filter);
    const query = `SELECT * FROM couriers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await conn.query<RowDataPacket[]>(query, [...params, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async countAll(filter: CourierListFilter = {}, connection?: PoolConnection): Promise<number> {
    const conn = connection || this.pool;
    const { where, params } = this.buildFilter(filter);
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM couriers ${where}`, params);
    return rows[0].count;
  }

  async findAvailableByOfficeId(deliveryOfficeId: string, connection?: PoolConnection): Promise<Courier[]> {
    const conn = connection || this.pool;
    // Only approved couriers can be assigned
    const query = "SELECT * FROM couriers WHERE delivery_office_id = ? AND is_available = TRUE AND is_active = TRUE AND approval_status = 'APPROVED'";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [deliveryOfficeId]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: PoolConnection): Promise<Courier[]> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM couriers WHERE delivery_office_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const [rows] = await conn.query<RowDataPacket[]>(query, [deliveryOfficeId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  // Approved, online freelancers seen recently. Distance filtering happens in the service.
  async findActiveFreelancers(seenWithinMinutes: number, connection?: PoolConnection): Promise<Courier[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM couriers
        WHERE courier_type = 'FREELANCE' AND approval_status = 'APPROVED' AND is_active = TRUE AND is_available = TRUE
          AND last_seen_at IS NOT NULL AND last_seen_at >= NOW() - INTERVAL ? MINUTE`,
      [seenWithinMinutes],
    );
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
    if (data.vehicleType) {
      fields.push("vehicle_type = ?");
      values.push(data.vehicleType);
    }
    if (data.licensePlate) {
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

  async deactivate(id: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.query("UPDATE couriers SET is_active = FALSE, is_available = FALSE WHERE id = ?", [id]);
  }

  async setApprovalStatus(id: string, status: CourierApprovalStatus, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    // Suspending also takes the courier offline so they drop out of the pool immediately
    const extra = status === "APPROVED" ? "" : ", is_available = FALSE";
    await conn.query(`UPDATE couriers SET approval_status = ?${extra} WHERE id = ?`, [status, id]);
  }

  async updateLocation(id: string, latitude: number, longitude: number, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.query("UPDATE couriers SET last_latitude = ?, last_longitude = ?, last_seen_at = NOW() WHERE id = ?", [latitude, longitude, id]);
  }

  async incrementCancellations(id: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.query("UPDATE couriers SET cancellation_count = cancellation_count + 1 WHERE id = ?", [id]);
  }

  async incrementDeliveries(id: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const query = "UPDATE couriers SET total_deliveries = total_deliveries + 1 WHERE id = ?";
    await conn.execute(query, [id]);
  }

  private buildFilter(filter: CourierListFilter): { where: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
    if (filter.courierType) {
      clauses.push("courier_type = ?");
      params.push(filter.courierType);
    }
    if (filter.approvalStatus) {
      clauses.push("approval_status = ?");
      params.push(filter.approvalStatus);
    }
    if (filter.search) {
      const like = `%${filter.search.replace(/[%_\\]/g, "\\$&")}%`;
      clauses.push("(full_name LIKE ? OR phone LIKE ?)");
      params.push(like, like);
    }
    if (filter.isActive !== undefined) {
      clauses.push("is_active = ?");
      params.push(filter.isActive);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
  }

  private mapToEntity(row: any): Courier {
    return {
      id: row.id,
      userId: row.user_id,
      deliveryOfficeId: row.delivery_office_id ?? null,
      courierType: (row.courier_type ?? "OFFICE") as CourierType,
      approvalStatus: (row.approval_status ?? "APPROVED") as CourierApprovalStatus,
      nationalIdUrl: row.national_id_url ?? null,
      licenseUrl: row.license_url ?? null,
      lastLatitude: row.last_latitude != null ? parseFloat(row.last_latitude) : null,
      lastLongitude: row.last_longitude != null ? parseFloat(row.last_longitude) : null,
      lastSeenAt: row.last_seen_at ?? null,
      cancellationCount: row.cancellation_count ?? 0,
      fullName: row.full_name,
      phone: row.phone,
      vehicleType: row.vehicle_type,
      licensePlate: row.license_plate,
      isAvailable: Boolean(row.is_available),
      isActive: Boolean(row.is_active),
      rating: parseFloat(row.rating),
      ratingCount: row.rating_count ?? 0,
      totalDeliveries: row.total_deliveries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
