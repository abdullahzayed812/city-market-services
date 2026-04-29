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
          commission_amount, commission_percentage, total_amount, 
          delivery_id, settlement_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    await conn.query(query, [
      order.id,
      order.customerOrderId,
      order.vendorId,
      order.status,
      order.subtotal,
      order.commissionAmount || 0,
      order.commissionPercentage || null,
      order.totalAmount,
      order.deliveryId || null,
      order.settlementId || null,
    ]);
    return order;
  }
  async findById(id: string, connection?: PoolConnection): Promise<VendorOrder | null> {
    const conn = connection || this.pool;
    const query = `
      SELECT vo.*, co.confirmation_expiry
      FROM vendor_orders vo
      JOIN customer_orders co ON vo.customer_order_id = co.id
      WHERE vo.id = ?
    `;
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
  async findByVendor(vendorId: string, limit: number, offset: number, connection?: PoolConnection): Promise<VendorOrder[]> {
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

  async findByVendorWithItems(vendorId: string, limit: number, offset: number, connection?: PoolConnection): Promise<VendorOrderWithItemsDto[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT
        vo.*,
        co.confirmation_expiry,
        voi.id AS item_id,
        voi.product_id AS item_product_id,
        voi.product_name AS item_product_name,
        voi.quantity AS item_quantity,
        voi.requested_weight_grams AS item_requested_weight_grams,
        voi.actual_weight_grams AS item_actual_weight_grams,
        voi.unit_price AS item_unit_price,
        voi.total_price AS item_total_price
      FROM vendor_orders vo
      JOIN customer_orders co ON vo.customer_order_id = co.id
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
          confirmationExpiry: row.confirmation_expiry ?? undefined,
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

  async markOrdersAsSettled(orderIds: string[], settlementId: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    if (orderIds.length === 0) return;
    const query = `UPDATE vendor_orders SET settlement_id = ? WHERE id IN (?)`;
    await conn.query(query, [settlementId, orderIds]);
  }

  async update(id: string, data: Partial<VendorOrder>, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.deliveryId) {
      fields.push("delivery_id = ?");
      values.push(data.deliveryId);
    }
    if (data.cancellationReason) {
      fields.push("cancellation_reason = ?");
      values.push(data.cancellationReason);
    }
    if (data.subtotal) {
      fields.push("subtotal = ?");
      values.push(data.subtotal);
    }
    if (data.commissionAmount) {
      fields.push("commission_amount = ?");
      values.push(data.commissionAmount);
    }
    if (data.totalAmount) {
      fields.push("total_amount = ?");
      values.push(data.totalAmount);
    }
    if (data.commissionPercentage) {
      fields.push("commission_percentage = ?");
      values.push(data.commissionPercentage);
    }
    if (data.settlementId) {
      fields.push("settlement_id = ?");
      values.push(data.settlementId);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE vendor_orders SET ${fields.join(", ")} WHERE id = ?`;
    await conn.execute(query, values);
  }

  async getVendorFinancials(
    vendorId: string,
    periodStart?: Date,
    periodEnd?: Date,
    connection?: PoolConnection,
  ): Promise<{ totalRevenue: number; platformCommission: number; totalOrders: number; vendorOrderIds: string[] }> {
    const conn = connection || this.pool;
    let query = `
      SELECT 
        SUM(subtotal) as totalRevenue,
        SUM(commission_amount) as platformCommission,
        COUNT(id) as totalOrders
      FROM vendor_orders 
      WHERE vendor_id = ? AND status = 'DELIVERED'
    `;
    const params: any[] = [vendorId];

    if (periodStart) {
      query += " AND created_at >= ?";
      params.push(periodStart);
    }
    if (periodEnd) {
      query += " AND created_at <= ?";
      params.push(periodEnd);
    }

    const [rows] = await conn.execute<RowDataPacket[]>(query, params);

    let idsQuery = `SELECT id FROM vendor_orders WHERE vendor_id = ? AND status = 'DELIVERED'`;
    const idsParams: any[] = [vendorId];
    if (periodStart) {
      idsQuery += " AND created_at >= ?";
      idsParams.push(periodStart);
    }
    if (periodEnd) {
      idsQuery += " AND created_at <= ?";
      idsParams.push(periodEnd);
    }
    const [idRows] = await conn.execute<RowDataPacket[]>(idsQuery, idsParams);

    return {
      totalRevenue: parseFloat(rows[0].totalRevenue) || 0,
      platformCommission: parseFloat(rows[0].platformCommission) || 0,
      totalOrders: parseInt(rows[0].totalOrders) || 0,
      vendorOrderIds: (idRows as any[]).map((r) => r.id),
    };
  }

  public mapToEntity(row: any): VendorOrder {
    return {
      id: row.id,
      customerOrderId: row.customer_order_id,
      vendorId: row.vendor_id,
      status: row.status,
      subtotal: parseFloat(row.subtotal),
      commissionAmount: parseFloat(row.commission_amount || 0),
      commissionPercentage: row.commission_percentage ? parseFloat(row.commission_percentage) : undefined,
      totalAmount: parseFloat(row.total_amount),
      deliveryId: row.delivery_id,
      settlementId: row.settlement_id,
      cancellationReason: row.cancellation_reason,
      confirmationExpiry: row.confirmation_expiry ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
