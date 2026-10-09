import { Pool, RowDataPacket, PoolConnection, ResultSetHeader } from "mysql2/promise";
import { randomUUID } from "crypto";
import { Delivery } from "../../core/entities/delivery.entity";
import { PickupLocation } from "../../core/entities/pickup-location.entity";
import { DeliveryFeeSplit, IDeliveryRepository } from "../../core/interfaces/delivery.repository";
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
        delivery_fee, fee_tier_id, courier_fee_percentage, courier_fee_amount, office_fee_amount, platform_fee_amount,
        open_to_freelance_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      delivery.feeTierId ?? null,
      delivery.courierFeePercentage ?? null,
      delivery.courierFeeAmount || 0,
      delivery.officeFeeAmount || 0,
      delivery.platformFeeAmount || 0,
      delivery.openToFreelanceAt ?? null,
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
    delivery.pickupLocations = (await this.getPickupLocationsForDeliveries([delivery.id], conn)).get(delivery.id) ?? [];
    return delivery;
  }

  // Locks only the deliveries row (no courier join) until the transaction ends.
  async findByIdForUpdate(id: string, connection: PoolConnection): Promise<Delivery | null> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT * FROM deliveries WHERE id = ? FOR UPDATE", [id]);
    if (rows.length === 0) return null;
    const delivery = this.mapToEntity(rows[0]);
    delivery.pickupLocations = (await this.getPickupLocationsForDeliveries([delivery.id], connection)).get(delivery.id) ?? [];
    return delivery;
  }

  async findByCustomerOrderId(customerOrderId: string, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone,
             c.vehicle_type as courier_vehicle_type, c.license_plate as courier_license_plate
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
    delivery.pickupLocations = (await this.getPickupLocationsForDeliveries([delivery.id], conn)).get(delivery.id) ?? [];
    return delivery;
  }

  async findByCourier(courierId: string, limit: number, offset: number, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.courier_id = ?
      ORDER BY COALESCE(d.assigned_at, d.created_at) DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [courierId, limit, offset]);
    return this.mapRowsToDeliveries(rows, conn); // Pass connection to helper
  }

  async findPending(limit: number, offset: number, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    // Only claimable rows: acceptDelivery() requires delivery_office_id IS NULL.
    const query = `
      SELECT d.*, c.full_name as courier_name, c.phone as courier_phone 
      FROM deliveries d
      LEFT JOIN couriers c ON d.courier_id = c.id
      WHERE d.status = "${DeliveryStatus.PENDING}" AND d.delivery_office_id IS NULL
      ORDER BY d.created_at
      LIMIT ? OFFSET ?
    `;
    // query() not execute(): mysql2 prepared statements reject numeric LIMIT params
    const [rows] = await conn.query<RowDataPacket[]>(query, [limit, offset]);
    return this.mapRowsToDeliveries(rows, conn); // Pass connection to helper
  }

  // Deliveries a freelancer may claim right now (same conditions as claimDelivery).
  async findFreelancePool(limit: number, offset: number, connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT d.* FROM deliveries d
        WHERE d.status = 'PENDING' AND d.delivery_office_id IS NULL AND d.courier_id IS NULL
          AND (d.open_to_freelance_at IS NULL OR d.open_to_freelance_at <= NOW())
        ORDER BY d.created_at
        LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  async findPendingNotYetOpenToFreelance(connection?: PoolConnection): Promise<Delivery[]> {
    const conn = connection || this.pool;
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT d.* FROM deliveries d
        WHERE d.status = 'PENDING' AND d.delivery_office_id IS NULL AND d.open_to_freelance_at > NOW()`,
    );
    return this.mapRowsToDeliveries(rows, conn);
  }

  async countActiveForCourier(courierId: string, connection?: PoolConnection): Promise<number> {
    const conn = connection || this.pool;
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM deliveries WHERE courier_id = ? AND status IN ('ASSIGNED', 'PICKED_UP', 'ON_THE_WAY')`,
      [courierId],
    );
    return Number(rows[0].count) || 0;
  }

  async countByStatusForCourier(courierId: string): Promise<Record<string, number>> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS n FROM deliveries WHERE courier_id = ? GROUP BY status`,
      [courierId],
    );
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  }

  async countByStatusForOffice(officeId: string): Promise<Record<string, number>> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS n FROM deliveries WHERE delivery_office_id = ? GROUP BY status`,
      [officeId],
    );
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  }

  // Cash the courier collected on delivered deliveries that no settlement has netted yet.
  async sumUnsettledCashForCourier(courierId: string, connection?: PoolConnection): Promise<number> {
    const conn = connection || this.pool;
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(cash_collected_amount), 0) AS total FROM deliveries
        WHERE courier_id = ? AND status = 'DELIVERED' AND courier_settlement_id IS NULL`,
      [courierId],
    );
    return Number(parseFloat(rows[0].total || 0).toFixed(2));
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
      WHERE (d.status = 'PENDING' AND d.delivery_office_id IS NULL AND d.courier_id IS NULL) OR d.delivery_office_id = ?
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
    // null clears the office (SLA revert to PENDING); undefined leaves it untouched
    if (data.deliveryOfficeId !== undefined) {
      fields.push("delivery_office_id = ?");
      values.push(data.deliveryOfficeId);
    }
    if (data.cashCollectedAmount !== undefined) {
      fields.push("cash_collected_amount = ?");
      values.push(data.cashCollectedAmount);
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

  private async getPickupLocationsForDeliveries(deliveryIds: string[], conn: Pool | PoolConnection): Promise<Map<string, PickupLocation[]>> {
    const byDelivery = new Map<string, PickupLocation[]>();
    if (deliveryIds.length === 0) return byDelivery;

    const placeholders = deliveryIds.map(() => "?").join(", ");
    const query = `SELECT id, delivery_id, vendor_order_id, address, latitude, longitude FROM delivery_pickup_locations WHERE delivery_id IN (${placeholders})`;
    const [rows] = await conn.query<RowDataPacket[]>(query, deliveryIds);
    for (const row of rows) {
      const list = byDelivery.get(row.delivery_id) ?? [];
      list.push({
        id: row.id,
        deliveryId: row.delivery_id,
        vendorOrderId: row.vendor_order_id,
        address: row.address,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      });
      byDelivery.set(row.delivery_id, list);
    }
    return byDelivery;
  }

  // One pickup-locations query for the whole page instead of one per row, so a
  // large list can't grab a pool connection per delivery.
  private async mapRowsToDeliveries(rows: RowDataPacket[], conn: Pool | PoolConnection): Promise<Delivery[]> {
    const deliveries = rows.map((row) => this.mapToEntity(row));
    const pickups = await this.getPickupLocationsForDeliveries(
      deliveries.map((d) => d.id),
      conn,
    );
    for (const delivery of deliveries) {
      delivery.pickupLocations = pickups.get(delivery.id) ?? [];
    }
    return deliveries;
  }

  async acceptDelivery(id: string, officeId: string, fees: DeliveryFeeSplit, connection?: PoolConnection): Promise<boolean> {
    const conn = connection || this.pool;
    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE deliveries
          SET delivery_office_id = ?, status = 'ACCEPTED', fulfillment_type = 'OFFICE',
              courier_fee_percentage = ?, courier_fee_amount = ?, office_fee_amount = ?, platform_fee_amount = ?
        WHERE id = ? AND status = 'PENDING' AND delivery_office_id IS NULL AND courier_id IS NULL`,
      [officeId, fees.courierPercentage, fees.courierFeeAmount, fees.officeFeeAmount, fees.platformFeeAmount, id],
    );
    return result.affectedRows > 0;
  }

  // Atomic: only one freelancer can win, and never after an office accepted it.
  async claimDelivery(id: string, courierId: string, fees: DeliveryFeeSplit, connection?: PoolConnection): Promise<boolean> {
    const conn = connection || this.pool;
    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE deliveries
          SET courier_id = ?, status = 'ASSIGNED', fulfillment_type = 'FREELANCE', assigned_at = NOW(),
              courier_fee_percentage = ?, courier_fee_amount = ?, office_fee_amount = 0, platform_fee_amount = ?,
              acceptance_deadline = NULL
        WHERE id = ? AND status = 'PENDING' AND delivery_office_id IS NULL AND courier_id IS NULL
          AND (open_to_freelance_at IS NULL OR open_to_freelance_at <= NOW())`,
      [courierId, fees.courierPercentage, fees.courierFeeAmount, fees.platformFeeAmount, id],
    );
    return result.affectedRows > 0;
  }

  // Back to the unclaimed pool: no office, no courier, no split. Offices already had
  // their priority window, so freelancers may claim immediately.
  async returnToPending(id: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.execute(
      `UPDATE deliveries
          SET status = 'PENDING', delivery_office_id = NULL, courier_id = NULL, assigned_at = NULL, fulfillment_type = NULL,
              courier_fee_percentage = NULL, courier_fee_amount = 0, office_fee_amount = 0, platform_fee_amount = 0,
              open_to_freelance_at = NOW(), assignment_deadline = NULL, pickup_deadline = NULL
        WHERE id = ?`,
      [id],
    );
  }

  // The office keeps the delivery but has to assign a new courier.
  async revertToAccepted(id: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await conn.execute(
      `UPDATE deliveries SET status = 'ACCEPTED', courier_id = NULL, assigned_at = NULL, pickup_deadline = NULL WHERE id = ?`,
      [id],
    );
  }

  // Returns how many rows were marked; fewer than deliveryIds.length means another
  // settlement already took some of them.
  async markDeliveriesAsCourierSettled(deliveryIds: string[], settlementId: string, connection?: PoolConnection): Promise<number> {
    if (deliveryIds.length === 0) return 0;
    const conn = connection || this.pool;
    const placeholders = deliveryIds.map(() => "?").join(", ");
    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE deliveries SET courier_settlement_id = ? WHERE id IN (${placeholders}) AND courier_settlement_id IS NULL`,
      [settlementId, ...deliveryIds],
    );
    return result.affectedRows;
  }

  async markDeliveriesAsOfficeSettled(deliveryIds: string[], settlementId: string, connection?: PoolConnection): Promise<number> {
    if (deliveryIds.length === 0) return 0;
    const conn = connection || this.pool;
    const placeholders = deliveryIds.map(() => "?").join(", ");
    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE deliveries SET office_settlement_id = ? WHERE id IN (${placeholders}) AND office_settlement_id IS NULL`,
      [settlementId, ...deliveryIds],
    );
    return result.affectedRows;
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
      fulfillmentType: row.fulfillment_type ?? null,
      status: row.status,
      deliveryFee: row.delivery_fee ? parseFloat(row.delivery_fee) : 0,
      feeTierId: row.fee_tier_id ?? null,
      courierFeePercentage: row.courier_fee_percentage != null ? parseFloat(row.courier_fee_percentage) : undefined,
      courierFeeAmount: row.courier_fee_amount ? parseFloat(row.courier_fee_amount) : 0,
      officeFeeAmount: row.office_fee_amount ? parseFloat(row.office_fee_amount) : 0,
      platformFeeAmount: row.platform_fee_amount ? parseFloat(row.platform_fee_amount) : 0,
      cashCollectedAmount: row.cash_collected_amount ? parseFloat(row.cash_collected_amount) : 0,
      openToFreelanceAt: row.open_to_freelance_at ?? null,
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
      courierVehicleType: row.courier_vehicle_type ?? undefined,
      courierLicensePlate: row.courier_license_plate ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
