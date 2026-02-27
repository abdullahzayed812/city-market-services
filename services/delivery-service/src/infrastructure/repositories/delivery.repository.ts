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
        id, customer_order_id, vendor_order_id, status, delivery_address,
        delivery_latitude, delivery_longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.execute(query, [
      delivery.id,
      delivery.customerOrderId,
      delivery.vendorOrderId || null,
      delivery.status,
      delivery.deliveryAddress,
      delivery.deliveryLatitude || null,
      delivery.deliveryLongitude || null,
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
    return this.mapRowsToDeliveries(rows, conn); // Pass connection to helper
  }

  async update(id: string, data: Partial<Delivery>, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.notes !== undefined) {
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
    if (data.vendorOrderId !== undefined) {
      fields.push("vendor_order_id = ?");
      values.push(data.vendorOrderId);
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

  private async getPickupLocationsForDelivery(deliveryId: string, conn: Pool | PoolConnection): Promise<PickupLocation[]> {
    const query = "SELECT id, delivery_id, vendor_order_id, address, latitude, longitude FROM delivery_pickup_locations WHERE delivery_id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [deliveryId]);
    return (rows as RowDataPacket[]).map(row => ({
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
      })
    );
  }

  private mapToEntity(row: any): Delivery {
    return {
      id: row.id,
      customerOrderId: row.customer_order_id,
      vendorOrderId: row.vendor_order_id,
      courierId: row.courier_id,
      status: row.status,
      pickupLocations: [], // Will be populated by separate query
      deliveryAddress: row.delivery_address,
      deliveryLatitude: row.delivery_latitude,
      deliveryLongitude: row.delivery_longitude,
      assignedAt: row.assigned_at,
      pickedUpAt: row.picked_up_at,
      deliveredAt: row.delivered_at,
      notes: row.notes,
      courierName: row.courier_name,
      courierPhone: row.courier_phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
