import { Pool, RowDataPacket } from "mysql2/promise";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { Database } from "@city-market/shared";

export class VendorOrderRepository implements IVendorOrderRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(order: VendorOrder): Promise<VendorOrder> {
    const query = `
      INSERT INTO vendor_orders (
        id, customer_order_id, vendor_id, status, subtotal,
        commission_amount, total_amount, delivery_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.pool.query(query, [
      order.id,
      order.customerOrderId,
      order.vendorId,
      order.status,
      order.subtotal,
      order.commissionAmount,
      order.totalAmount,
      order.deliveryId || null,
    ]);
    return order;
  }

  async findById(id: string): Promise<VendorOrder | null> {
    const query = "SELECT * FROM vendor_orders WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByCustomerOrder(customerOrderId: string): Promise<VendorOrder[]> {
    const query = "SELECT * FROM vendor_orders WHERE customer_order_id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [customerOrderId]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByVendor(vendorId: string, limit: number, offset: number): Promise<VendorOrder[]> {
    const query = `
      SELECT * FROM vendor_orders 
      WHERE vendor_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [vendorId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByStatus(status: string): Promise<VendorOrder[]> {
    const query = "SELECT * FROM vendor_orders WHERE status = ? ORDER BY created_at DESC";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [status]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const query = "UPDATE vendor_orders SET status = ? WHERE id = ?";
    await this.pool.execute(query, [status, id]);
  }

  async update(id: string, data: Partial<VendorOrder>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.deliveryId !== undefined) {
      fields.push("delivery_id = ?");
      values.push(data.deliveryId);
    }
    if (data.cancellationReason !== undefined) {
      fields.push("cancellation_reason = ?");
      values.push(data.cancellationReason);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE vendor_orders SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  private mapToEntity(row: any): VendorOrder {
    return {
      id: row.id,
      customerOrderId: row.customer_order_id,
      vendorId: row.vendor_id,
      status: row.status,
      subtotal: parseFloat(row.subtotal),
      commissionAmount: parseFloat(row.commission_amount),
      totalAmount: parseFloat(row.total_amount),
      deliveryId: row.delivery_id,
      cancellationReason: row.cancellation_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
