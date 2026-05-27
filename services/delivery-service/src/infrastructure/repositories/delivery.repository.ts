import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
import { randomUUID } from "crypto";
import { Delivery } from "../../core/entities/delivery.entity";
import { PickupLocation } from "../../core/entities/pickup-location.entity";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { DeliveryStatus } from "@city-market/shared";
import { Database } from "@city-market/shared/node";

export class DeliveryRepository implements IDeliveryRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(delivery: Delivery, connection?: PoolConnection): Promise<Delivery> {
    const conn = connection || this.pool;
    const query = `
      INSERT INTO deliveries (
        id, customer_id, customer_order_id, vendor_order_id, status,
        delivery_address, delivery_latitude, delivery_longitude,
        total_price, items_count,
        delivery_fee, courier_fee_percentage, courier_fee_amount, office_fee_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.execute(query, [
      delivery.id,
      delivery.customerId,
      delivery.customerOrderId,
      delivery.vendorOrderId || null,
      delivery.status,
      delivery.deliveryAddress,
      delivery.deliveryLatitude || null,
      delivery.deliveryLongitude || null,
      delivery.totalPrice || 0,
      delivery.itemsCount || 0,
      delivery.deliveryFee || 0,
      delivery.courierFeePercentage ?? null,
      delivery.courierFeeAmount || 0,
      delivery.officeFeeAmount || 0,
    ]);

    // Insert into delivery_pickup_locations table
    for (const pickup of delivery.pickupLocations) {
      const pickupQuery = `
        INSERT INTO delivery_pickup_locations (
          id, delivery_id, vendor_order_id, address, latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      await conn.execute(pickupQuery, [
        randomUUID(), // Generate new ID for pickup location
        delivery.id,
        pickup.vendorOrderId,
        pickup.address,
        pickup.latitude || null,
        pickup.longitude || null,
      ]);
    }
    return delivery;
  }

  async findById(id: string, connection?: PoolConnection): Promise<Delivery | null> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.id = ?
    `;
    const [rows] = await conn.execute<RowDataPacket[]>(query, [id]);
    if (rows.length === 0) return null;

    const delivery = this.mapToEntity(rows[0]);
    delivery.pickupLocations = await this.getPickupLocationsForDelivery(delivery.id, conn); // Pass connection
    return delivery;
  }

  async findByCustomerOrderId(customerOrderId: string, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.customer_order_id = ?
    `;
    const [rows] = await conn.execute<RowDataPacket[]>(query, [customerOrderId]);

    return this.mapRowsToDeliveries(rows, conn); // Pass connection to helper
  }

  async findByCustomerOrderAndVendorOrder(customerOrderId: string, vendorOrderId: string, connection?: PoolConnection): Promise<Delivery | null> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.customer_order_id = ? AND d.vendor_order_id = ?
    `;
    const [rows] = await conn.execute<RowDataPacket[]>(query, [customerOrderId, vendorOrderId]);
    if (rows.length === 0) return null;

    const delivery = this.mapToEntity(rows[0]);
    delivery.pickupLocations = await this.getPickupLocationsForDelivery(delivery.id, conn); // Pass connection
    return delivery;
  }

  async findByCourier(courierId: string, limit: number, offset: number, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.courier_id = ? 
      ORDER BY d.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [courierId, limit, offset]);
    return this.mapRowsToDeliveries(rows, conn); // Pass connection to helper
  }

  async findPending(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.status = "${DeliveryStatus.PENDING}" 
      ORDER BY d.created_at
    `;
    const [rows] = await conn.execute<RowDataPacket[]>(query);
    return this.mapRowsToDeliveries(rows, conn); // Pass connection to helper
  }

  async findByStatus(status: string, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.status = ? 
      ORDER BY d.created_at DESC
    `;
    const [rows] = await conn.execute<RowDataPacket[]>(query, [status]);
    return this.mapRowsToDeliveries(rows, conn); // Pass connection to helper
  }

  async findAll(limit: number, offset: number, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      ORDER BY d.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [limit, offset]);
    return this.mapRowsToDeliveries(rows, conn);
  }

  async findForManager(officeId: string, limit: number, offset: number, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.status = 'PENDING' OR d.delivery_office_id = ?
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [officeId, limit, offset]);
    return this.mapRowsToDeliveries(rows, conn);
  }

  async update(id: string, data: Partial<Delivery>, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.notes) {
      fields.push("notes = ?");
      values.push(data.notes);
    }
    if (data.pickedUpAt) {
      fields.push("picked_up_at = ?");
      values.push(data.pickedUpAt);
    }
    if (data.deliveredAt) {
      fields.push("delivered_at = ?");
      values.push(data.deliveredAt);
    }
    if (data.vendorOrderId) {
      fields.push("vendor_order_id = ?");
      values.push(data.vendorOrderId);
    }
    if (data.deliveryOfficeId) {
      fields.push("delivery_office_id = ?");
      values.push(data.deliveryOfficeId);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE deliveries SET ${fields.join(", ")} WHERE id = ?`;
    await conn.query(query, values);
  }

  async assignCourier(id: string, courierId: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const query = `UPDATE deliveries SET courier_id = ?, status = "${DeliveryStatus.ASSIGNED}", assigned_at = NOW() WHERE id = ?`;
    await conn.execute(query, [courierId, id]);
  }

  async countByVendorOrderIds(vendorOrderIds: string[], periodStart?: Date, periodEnd?: Date, connection?: PoolConnection): Promise<number> {
    if (!vendorOrderIds || vendorOrderIds.length === 0) return 0;

    const conn = connection || this.pool;
    let query = `
      SELECT COUNT(DISTINCT d.id) as totalDeliveries
      FROM deliveries d
      JOIN delivery_pickup_locations p ON d.id = p.delivery_id
      WHERE p.vendor_order_id IN (${vendorOrderIds.map(() => "?").join(",")}) 
      AND d.status = 'DELIVERED'
    `;
    const params: any[] = [...vendorOrderIds];

    if (periodStart) {
      query += " AND d.created_at >= ?";
      params.push(periodStart);
    }
    if (periodEnd) {
      query += " AND d.created_at <= ?";
      params.push(periodEnd);
    }

    const [rows] = await conn.execute<RowDataPacket[]>(query, params);
    return parseInt(rows[0].totalDeliveries) || 0;
  }

  private async getPickupLocationsForDelivery(deliveryId: string, conn: Pool | PoolConnection): Promise<PickupLocation[]> {
    const query = "SELECT id, delivery_id, vendor_order_id, address, latitude, longitude FROM delivery_pickup_locations WHERE delivery_id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [deliveryId]);
    return (rows as RowDataPacket[]).map((row) => ({
      id: row.id,
      deliveryId: row.delivery_id,
      vendorOrderId: row.vendor_order_id,
      address: row.address,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
    }));
  }

  private async mapRowsToDeliveries(rows: RowDataPacket[], conn: Pool | PoolConnection): Promise<Delivery[]> {
    return Promise.all(
      rows.map(async (row) => {
        const delivery = this.mapToEntity(row);
        delivery.pickupLocations = await this.getPickupLocationsForDelivery(delivery.id, conn); // Pass conn
        return delivery;
      }),
    );
  }

  async acceptDelivery(id: string, officeId: string, windowMinutes: number, connection?: any): Promise<boolean> {
    const conn = connection || this.pool;
    const [result]: any = await conn.execute(
      `UPDATE deliveries SET delivery_office_id = ?, status = 'ACCEPTED'
       WHERE id = ? AND status = 'PENDING' AND delivery_office_id IS NULL`,
      [officeId, id],
    );
    return result.affectedRows > 0;
  }

  async markDeliveriesAsCourierSettled(deliveryIds: string[], settlementId: string, connection?: any): Promise<void> {
    if (deliveryIds.length === 0) return;
    const conn = connection || this.pool;
    const placeholders = deliveryIds.map(() => "?").join(", ");
    await (conn as any).query(`UPDATE deliveries SET courier_settlement_id = ? WHERE id IN (${placeholders})`, [settlementId, ...deliveryIds]);
  }

  async markDeliveriesAsOfficeSettled(deliveryIds: string[], settlementId: string, connection?: any): Promise<void> {
    if (deliveryIds.length === 0) return;
    const conn = connection || this.pool;
    const placeholders = deliveryIds.map(() => "?").join(", ");
    await (conn as any).query(`UPDATE deliveries SET office_settlement_id = ? WHERE id IN (${placeholders})`, [settlementId, ...deliveryIds]);
  }

  async setDeadline(id: string, field: "acceptanceDeadline" | "assignmentDeadline" | "pickupDeadline", deadline: Date | null, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const colMap = { acceptanceDeadline: "acceptance_deadline", assignmentDeadline: "assignment_deadline", pickupDeadline: "pickup_deadline" };
    await conn.execute(`UPDATE deliveries SET ${colMap[field]} = ? WHERE id = ?`, [deadline, id]);
  }

  async findExpiredPending(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT d.*, c.full_name as courier_name, c.phone as courier_phone FROM deliveries d LEFT JOIN couriers c ON d.courier_id = c.id WHERE d.status = 'PENDING' AND d.acceptance_deadline IS NOT NULL AND d.acceptance_deadline < NOW()`,
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  async findExpiredAccepted(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT d.*, c.full_name as courier_name, c.phone as courier_phone FROM deliveries d LEFT JOIN couriers c ON d.courier_id = c.id WHERE d.status = 'ACCEPTED' AND d.assignment_deadline IS NOT NULL AND d.assignment_deadline < NOW()`,
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  async findExpiredAssigned(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT d.*, c.full_name as courier_name, c.phone as courier_phone FROM deliveries d LEFT JOIN couriers c ON d.courier_id = c.id WHERE d.status = 'ASSIGNED' AND d.pickup_deadline IS NOT NULL AND d.pickup_deadline < NOW()`,
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  async findPendingWithFutureDeadline(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT d.*, c.full_name as courier_name, c.phone as courier_phone FROM deliveries d LEFT JOIN couriers c ON d.courier_id = c.id WHERE d.status = 'PENDING' AND d.acceptance_deadline IS NOT NULL AND d.acceptance_deadline > NOW()`,
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  async findAcceptedWithFutureDeadline(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT d.*, c.full_name as courier_name, c.phone as courier_phone FROM deliveries d LEFT JOIN couriers c ON d.courier_id = c.id WHERE d.status = 'ACCEPTED' AND d.assignment_deadline IS NOT NULL AND d.assignment_deadline > NOW()`,
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  async findAssignedWithFutureDeadline(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT d.*, c.full_name as courier_name, c.phone as courier_phone FROM deliveries d LEFT JOIN couriers c ON d.courier_id = c.id WHERE d.status = 'ASSIGNED' AND d.pickup_deadline IS NOT NULL AND d.pickup_deadline > NOW()`,
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  private mapToEntity(row: any): Delivery {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerOrderId: row.customer_order_id,
      vendorOrderId: row.vendor_order_id,
      courierId: row.courier_id,
      deliveryOfficeId: row.delivery_office_id ?? undefined,
      status: row.status,
      deliveryFee: row.delivery_fee ? parseFloat(row.delivery_fee) : 0,
      courierFeePercentage: row.courier_fee_percentage != null ? parseFloat(row.courier_fee_percentage) : undefined,
      courierFeeAmount: row.courier_fee_amount ? parseFloat(row.courier_fee_amount) : 0,
      officeFeeAmount: row.office_fee_amount ? parseFloat(row.office_fee_amount) : 0,
      pickupLocations: [],
      deliveryAddress: row.delivery_address,
      deliveryLatitude: row.delivery_latitude,
      deliveryLongitude: row.delivery_longitude,
      totalPrice: row.total_price ? parseFloat(row.total_price) : 0,
      itemsCount: row.items_count || 0,
      officeSettlementId: row.office_settlement_id ?? undefined,
      courierSettlementId: row.courier_settlement_id ?? undefined,
      assignedAt: row.assigned_at,
      pickedUpAt: row.picked_up_at,
      deliveredAt: row.delivered_at,
      notes: row.notes,
      acceptanceDeadline: row.acceptance_deadline ?? undefined,
      assignmentDeadline: row.assignment_deadline ?? undefined,
      pickupDeadline: row.pickup_deadline ?? undefined,
      courierName: row.courier_name,
      courierPhone: row.courier_phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
