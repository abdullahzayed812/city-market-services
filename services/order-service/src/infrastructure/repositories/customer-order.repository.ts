import * as mysql from "mysql2/promise"; // For mysql.ResultSetHeader
import { Pool, RowDataPacket, PoolConnection, ResultSetHeader } from "mysql2/promise"; // Direct types
import { CustomerOrder } from "../../core/entities/customer-order.entity";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { CustomerOrderStatus } from "@city-market/shared";
import { Database } from "@city-market/shared/node";

export class CustomerOrderRepository implements ICustomerOrderRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(order: CustomerOrder, connection?: PoolConnection): Promise<CustomerOrder> {
    const conn = connection || this.pool;
    const query = `
      INSERT INTO customer_orders (
        id, customer_id, status, subtotal, delivery_fee,
        commission_amount, total_amount, delivery_address, delivery_latitude,
        delivery_longitude, customer_notes, confirmation_expiry
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.query(query, [
      order.id,
      order.customerId,
      order.status,
      order.subtotal,
      order.deliveryFee,
      order.commissionAmount,
      order.totalAmount,
      order.deliveryAddress,
      order.deliveryLatitude || null,
      order.deliveryLongitude || null,
      order.customerNotes || null,
      order.confirmationExpiry || null,
    ]);
    return order;
  }

  async findExpiredAwaitingConfirmation(connection?: PoolConnection): Promise<CustomerOrder[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT * FROM customer_orders
      WHERE status = 'AWAITING_CUSTOMER_CONFIRMATION'
        AND confirmation_expiry IS NOT NULL
        AND confirmation_expiry < NOW()
    `;
    const [rows] = await conn.execute<RowDataPacket[]>(query);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findById(id: string, connection?: PoolConnection): Promise<CustomerOrder | null> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM customer_orders WHERE id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByIdWithLock(id: string, connection: PoolConnection): Promise<CustomerOrder | null> {
    const query = "SELECT * FROM customer_orders WHERE id = ? FOR UPDATE";
    const [rows] = await connection.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByCustomer(customerId: string, limit: number, offset: number, connection?: PoolConnection): Promise<CustomerOrder[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT * FROM customer_orders 
      WHERE customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [customerId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByStatus(status: string, connection?: PoolConnection): Promise<CustomerOrder[]> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM customer_orders WHERE status = ? ORDER BY created_at DESC";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [status]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findAll(limit: number, offset: number, connection?: PoolConnection): Promise<CustomerOrder[]> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM customer_orders ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const [rows] = await conn.query<RowDataPacket[]>(query, [limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async updateStatus(id: string, status: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const query = "UPDATE customer_orders SET status = ? WHERE id = ?";
    await conn.query(query, [status, id]);
  }

  async update(id: string, data: Partial<CustomerOrder>, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.cancellationReason) {
      fields.push("cancellation_reason = ?");
      values.push(data.cancellationReason);
    }
    if (data.confirmationExpiry) {
      fields.push("confirmation_expiry = ?");
      values.push(data.confirmationExpiry);
    }
    // Add other updatable fields here if necessary, e.g., total amounts
    if (data.subtotal) {
      fields.push("subtotal = ?");
      values.push(data.subtotal);
    }
    if (data.deliveryFee) {
      fields.push("delivery_fee = ?");
      values.push(data.deliveryFee);
    }
    if (data.commissionAmount) {
      fields.push("commission_amount = ?");
      values.push(data.commissionAmount);
    }
    if (data.totalAmount) {
      fields.push("total_amount = ?");
      values.push(data.totalAmount);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE customer_orders SET ${fields.join(", ")} WHERE id = ?`;
    await conn.execute(query, values);
  }

  async conditionalUpdateStatusToReady(id: string, connection?: PoolConnection): Promise<number> {
    const conn = connection || this.pool;
    const query = `
            UPDATE customer_orders
            SET status = ?
            WHERE id = ? AND status != ?
        `;
    const [result] = await conn.execute(query, [CustomerOrderStatus.READY, id, CustomerOrderStatus.READY]);
    return (result as mysql.ResultSetHeader).affectedRows;
  }

  private mapToEntity(row: any): CustomerOrder {
    return {
      id: row.id,
      customerId: row.customer_id,
      status: row.status,
      subtotal: parseFloat(row.subtotal),
      deliveryFee: parseFloat(row.delivery_fee),
      commissionAmount: parseFloat(row.commission_amount),
      totalAmount: parseFloat(row.total_amount),
      deliveryAddress: row.delivery_address,
      deliveryLatitude: row.delivery_latitude,
      deliveryLongitude: row.delivery_longitude,
      customerNotes: row.customer_notes,
      cancellationReason: row.cancellation_reason,
      confirmationExpiry: row.confirmation_expiry ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
