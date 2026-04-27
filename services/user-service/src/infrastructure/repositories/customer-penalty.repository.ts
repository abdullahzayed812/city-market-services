import { Pool, RowDataPacket } from "mysql2/promise";
import { CustomerPenalty } from "../../core/entities/customer-penalty.entity";
import { ICustomerPenaltyRepository } from "../../core/interfaces/customer-penalty.repository";
import { Database } from "@city-market/shared/node";

export class CustomerPenaltyRepository implements ICustomerPenaltyRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(penalty: CustomerPenalty): Promise<void> {
    await this.pool.execute(
      `INSERT INTO customer_penalties
         (id, customer_id, customer_order_id, delivery_id, reason,
          device_id, device_platform, device_model, device_app_version, device_ip,
          is_active, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        penalty.id,
        penalty.customerId,
        penalty.customerOrderId,
        penalty.deliveryId ?? null,
        penalty.reason,
        penalty.deviceId ?? null,
        penalty.devicePlatform ?? null,
        penalty.deviceModel ?? null,
        penalty.deviceAppVersion ?? null,
        penalty.deviceIp ?? null,
        penalty.isActive,
        penalty.expiresAt ?? null,
        penalty.createdAt,
      ],
    );
  }

  async hasActivePenalty(customerId: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM customer_penalties WHERE customer_id = ? AND is_active = TRUE LIMIT 1`,
      [customerId],
    );
    return rows.length > 0;
  }
}
