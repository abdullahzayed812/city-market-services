import { Pool, RowDataPacket } from "mysql2/promise";
import { CustomerOrder } from "../../core/entities/customer-order.entity";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { Database } from "@city-market/shared";

export class CustomerOrderRepository implements ICustomerOrderRepository {
    private pool: Pool;

    constructor(private db: Database) {
        this.pool = this.db.getPool();
    }

    async create(order: CustomerOrder): Promise<CustomerOrder> {
        const query = `
      INSERT INTO customer_orders (
        id, customer_id, status, subtotal, delivery_fee,
        commission_amount, total_amount, delivery_address, delivery_latitude,
        delivery_longitude, customer_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        await this.pool.query(query, [
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
        ]);
        return order;
    }

    async findById(id: string): Promise<CustomerOrder | null> {
        const query = "SELECT * FROM customer_orders WHERE id = ?";
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
        return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
    }

    async findByCustomer(customerId: string, limit: number, offset: number): Promise<CustomerOrder[]> {
        const query = `
      SELECT * FROM customer_orders 
      WHERE customer_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
        const [rows] = await this.pool.query<RowDataPacket[]>(query, [customerId, limit, offset]);
        return rows.map((row) => this.mapToEntity(row));
    }

    async findByStatus(status: string): Promise<CustomerOrder[]> {
        const query = "SELECT * FROM customer_orders WHERE status = ? ORDER BY created_at DESC";
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [status]);
        return rows.map((row) => this.mapToEntity(row));
    }

    async findAll(limit: number, offset: number): Promise<CustomerOrder[]> {
        const query = "SELECT * FROM customer_orders ORDER BY created_at DESC LIMIT ? OFFSET ?";
        const [rows] = await this.pool.query<RowDataPacket[]>(query, [limit, offset]);
        return rows.map((row) => this.mapToEntity(row));
    }

    async updateStatus(id: string, status: string): Promise<void> {
        const query = "UPDATE customer_orders SET status = ? WHERE id = ?";
        await this.pool.execute(query, [status, id]);
    }

    async update(id: string, data: Partial<CustomerOrder>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.status) {
            fields.push("status = ?");
            values.push(data.status);
        }
        if (data.cancellationReason !== undefined) {
            fields.push("cancellation_reason = ?");
            values.push(data.cancellationReason);
        }

        if (fields.length === 0) return;

        values.push(id);
        const query = `UPDATE customer_orders SET ${fields.join(", ")} WHERE id = ?`;
        await this.pool.execute(query, values);
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
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
