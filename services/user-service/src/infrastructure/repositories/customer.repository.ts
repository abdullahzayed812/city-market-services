import { Pool, RowDataPacket } from "mysql2/promise";
import { Customer } from "../../core/entities/customer.entity";
import { ICustomerRepository } from "../../core/interfaces/customer.repository";
import { Database } from "@city-market/shared/node";

const BASE_QUERY = `
  SELECT c.*,
    EXISTS(
      SELECT 1 FROM customer_penalties p
      WHERE p.customer_id = c.id AND p.is_active = TRUE
    ) AS has_penalty
  FROM customers c
`;

export class CustomerRepository implements ICustomerRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(customer: Customer): Promise<Customer> {
    await this.pool.execute(
      "INSERT INTO customers (id, user_id, full_name, phone) VALUES (?, ?, ?, ?)",
      [customer.id, customer.userId, customer.fullName, customer.phone || null],
    );
    return customer;
  }

  async findById(id: string): Promise<Customer | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `${BASE_QUERY} WHERE c.id = ?`,
      [id],
    );
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Customer | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `${BASE_QUERY} WHERE c.user_id = ?`,
      [userId],
    );
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Customer[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `${BASE_QUERY} WHERE c.id IN (${placeholders}) OR c.user_id IN (${placeholders})`,
      [...ids, ...ids],
    );
    return rows.map(row => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Customer>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.fullName) {
      fields.push("full_name = ?");
      values.push(data.fullName);
    }
    if (data.phone !== undefined) {
      fields.push("phone = ?");
      values.push(data.phone);
    }

    if (fields.length === 0) return;
    values.push(id);
    await this.pool.execute(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`, values);
  }

  async updateDeviceInfo(
    id: string,
    info: {
      deviceId: string;
      devicePlatform: string;
      deviceModel?: string;
      deviceAppVersion?: string;
      deviceIp?: string;
    },
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE customers
       SET device_id = ?, device_platform = ?, device_model = ?,
           device_app_version = ?, device_ip = ?, device_updated_at = NOW()
       WHERE id = ?`,
      [
        info.deviceId,
        info.devicePlatform,
        info.deviceModel ?? null,
        info.deviceAppVersion ?? null,
        info.deviceIp ?? null,
        id,
      ],
    );
  }

  private mapToEntity(row: any): Customer {
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      hasPenalty: Boolean(row.has_penalty),
      deviceId: row.device_id,
      devicePlatform: row.device_platform,
      deviceModel: row.device_model,
      deviceAppVersion: row.device_app_version,
      deviceIp: row.device_ip,
      deviceUpdatedAt: row.device_updated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
