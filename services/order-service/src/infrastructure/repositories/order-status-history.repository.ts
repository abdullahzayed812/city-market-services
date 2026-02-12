import { Pool, RowDataPacket } from "mysql2/promise";
import { OrderStatusHistory } from "../../core/entities/order-status-history.entity";
import { IOrderStatusHistoryRepository } from "../../core/interfaces/order-status-history.repository";
import { Database } from "@city-market/shared";

export class OrderStatusHistoryRepository implements IOrderStatusHistoryRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(history: OrderStatusHistory): Promise<OrderStatusHistory> {
    const query = `
      INSERT INTO order_status_history (
        id, customer_order_id, vendor_order_id, status, notes
      ) VALUES (?, ?, ?, ?, ?)
    `;
    await this.pool.query(query, [
      history.id,
      history.customerOrderId || null,
      history.vendorOrderId || null,
      history.status,
      history.notes || null,
    ]);
    return history;
  }

  async findByCustomerOrder(customerOrderId: string): Promise<OrderStatusHistory[]> {
    const query = "SELECT * FROM order_status_history WHERE customer_order_id = ? ORDER BY created_at DESC";
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [customerOrderId]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByVendorOrder(vendorOrderId: string): Promise<OrderStatusHistory[]> {
    const query = "SELECT * FROM order_status_history WHERE vendor_order_id = ? ORDER BY created_at DESC";
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [vendorOrderId]);
    return rows.map((row) => this.mapToEntity(row));
  }

  private mapToEntity(row: any): OrderStatusHistory {
    return {
      id: row.id,
      customerOrderId: row.customer_order_id,
      vendorOrderId: row.vendor_order_id,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }
}
