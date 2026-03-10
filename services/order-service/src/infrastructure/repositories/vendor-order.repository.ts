import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { Database } from "@city-market/shared/node";
import { VendorOrderWithItemsDto } from "@city-market/shared";

export class VendorOrderRepository implements IVendorOrderRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(order: VendorOrder, connection?: PoolConnection): Promise<VendorOrder> {
    const conn = connection || this.pool;
    const query = `
        INSERT INTO vendor_orders (
          id, customer_order_id, vendor_id, status, subtotal,
          commission_amount, total_amount, delivery_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
    await conn.query(query, [
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
  async findById(id: string, connection?: PoolConnection): Promise<VendorOrder | null> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM vendor_orders WHERE id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByIdWithLock(id: string, connection: PoolConnection): Promise<VendorOrder | null> {
    const query = "SELECT * FROM vendor_orders WHERE id = ? FOR UPDATE";
    const [rows] = await connection.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }
  async findByCustomerOrder(customerOrderId: string, connection?: PoolConnection): Promise<VendorOrder[]> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM vendor_orders WHERE customer_order_id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [customerOrderId]);
    return rows.map((row) => this.mapToEntity(row));
  }
  async findByVendor(
    vendorId: string,
    limit: number,
    offset: number,
    connection?: PoolConnection
  ): Promise<VendorOrder[]> {
    const conn = connection || this.pool;
    const query = `
        SELECT * FROM vendor_orders 
        WHERE vendor_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [vendorId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByVendorWithItems(
    vendorId: string,
    limit: number,
    offset: number,
    connection?: PoolConnection
  ): Promise<VendorOrderWithItemsDto[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT
        vo.*,
        voi.id AS item_id,
        voi.product_id AS item_product_id,
        voi.product_name AS item_product_name,
        voi.quantity AS item_quantity,
        voi.requested_weight_grams AS item_requested_weight_grams,
        voi.actual_weight_grams AS item_actual_weight_grams,
        voi.unit_price AS item_unit_price,
        voi.total_price AS item_total_price
      FROM vendor_orders vo
      LEFT JOIN vendor_order_items voi ON vo.id = voi.vendor_order_id
      WHERE vo.id IN (
        SELECT id FROM (
          SELECT id
          FROM vendor_orders
          WHERE vendor_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        ) AS paged_orders
      )
      ORDER BY vo.created_at DESC, voi.id;
    `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [vendorId, limit, offset]);

    const ordersMap = new Map<string, VendorOrderWithItemsDto>();

    for (const row of rows) {
      const orderId = row.id;
      let order = ordersMap.get(orderId);

      if (!order) {
        order = {
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
          items: [],
        };
        ordersMap.set(orderId, order);
      }

      if (row.item_id) {
        order.items.push({
          id: row.item_id,
          vendorOrderId: row.id,
          vendorProductId: row.item_product_id,
          productName: row.item_product_name,
          quantity: row.item_quantity,
          requestedWeightGrams: row.item_requested_weight_grams,
          actualWeightGrams: row.item_actual_weight_grams,
          unitPrice: parseFloat(row.item_unit_price),
          totalPrice: parseFloat(row.item_total_price),
        });
      }
    }

    return Array.from(ordersMap.values());
  }

  async findByStatus(status: string, connection?: PoolConnection): Promise<VendorOrder[]> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM vendor_orders WHERE status = ? ORDER BY created_at DESC";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [status]);
    return rows.map((row) => this.mapToEntity(row));
  }
  async updateStatus(id: string, status: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const query = "UPDATE vendor_orders SET status = ? WHERE id = ?";
    await conn.execute(query, [status, id]);
  }
  async update(id: string, data: Partial<VendorOrder>, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
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
    if (data.subtotal !== undefined) {
      fields.push("subtotal = ?");
      values.push(data.subtotal);
    }
    if (data.commissionAmount !== undefined) {
      fields.push("commission_amount = ?");
      values.push(data.commissionAmount);
    }
    if (data.totalAmount !== undefined) {
      fields.push("total_amount = ?");
      values.push(data.totalAmount);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE vendor_orders SET ${fields.join(", ")} WHERE id = ?`;
    await conn.execute(query, values);
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
