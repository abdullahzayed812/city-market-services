import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
import { CustomerPenalty } from "../../core/entities/customer-penalty.entity";
import { ICustomerPenaltyRepository } from "../../core/interfaces/customer-penalty.repository";
import { Database } from "@city-market/shared/node";

export class CustomerPenaltyRepository implements ICustomerPenaltyRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(penalty: CustomerPenalty, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.execute(
      `INSERT INTO customer_penalties (id, customer_id, customer_order_id, delivery_id, reason, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        penalty.id,
        penalty.customerId,
        penalty.customerOrderId,
        penalty.deliveryId || null,
        penalty.reason,
        penalty.isActive,
        penalty.createdAt,
      ],
    );
  }

  async hasActivePenalty(customerId: string, connection?: PoolConnection): Promise<boolean> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT 1 FROM customer_penalties WHERE customer_id = ? AND is_active = TRUE LIMIT 1`,
      [customerId],
    );
    return rows.length > 0;
  }
}
