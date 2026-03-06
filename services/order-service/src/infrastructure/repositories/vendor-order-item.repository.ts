import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
import { VendorOrderItem } from "../../core/entities/vendor-order-item.entity";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { Database } from "@city-market/shared/node";

export class VendorOrderItemRepository implements IVendorOrderItemRepository {
    private pool: Pool;

    constructor(private db: Database) {
        this.pool = this.db.getPool();
    }

    async create(item: VendorOrderItem, connection?: PoolConnection): Promise<VendorOrderItem> {
        const conn = connection || this.pool;
        const query = `
      INSERT INTO vendor_order_items (
        id, vendor_order_id, product_id, product_name,
        quantity, unit_price, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
        await conn.query(query, [
            item.id,
            item.vendorOrderId,
            item.vendorProductId,
            item.productName,
            item.quantity,
            item.unitPrice,
            item.totalPrice,
        ]);
        return item;
    }

    async findByVendorOrder(vendorOrderId: string, connection?: PoolConnection): Promise<VendorOrderItem[]> {
        const conn = connection || this.pool;
        const query = "SELECT * FROM vendor_order_items WHERE vendor_order_id = ?";
        const [rows] = await conn.execute<RowDataPacket[]>(query, [vendorOrderId]);
        return rows.map((row) => this.mapToEntity(row));
    }

    async findById(id: string, connection?: PoolConnection): Promise<VendorOrderItem | null> {
        const conn = connection || this.pool;
        const query = "SELECT * FROM vendor_order_items WHERE id = ?";
        const [rows] = await conn.execute<RowDataPacket[]>(query, [id]);
        return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
    }

    async findByIdWithLock(id: string, connection: PoolConnection): Promise<VendorOrderItem | null> {
        const query = "SELECT * FROM vendor_order_items WHERE id = ? FOR UPDATE";
        const [rows] = await connection.execute<RowDataPacket[]>(query, [id]);
        return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
    }

    async update(id: string, data: Partial<VendorOrderItem>, connection?: PoolConnection): Promise<void> {
        const conn = connection || this.pool;
        const fields: string[] = [];
        const values: any[] = [];

        if (data.quantity !== undefined) {
            fields.push("quantity = ?");
            values.push(data.quantity);
        }
        if (data.unitPrice !== undefined) {
            fields.push("unit_price = ?");
            values.push(data.unitPrice);
        }
        if (data.totalPrice !== undefined) {
            fields.push("total_price = ?");
            values.push(data.totalPrice);
        }

        if (fields.length === 0) return;

        values.push(id);
        const query = `UPDATE vendor_order_items SET ${fields.join(", ")} WHERE id = ?`;
        await conn.execute(query, values);
    }

    private mapToEntity(row: any): VendorOrderItem {
        return {
            id: row.id,
            vendorOrderId: row.vendor_order_id,
            vendorProductId: row.product_id,
            productName: row.product_name,
            quantity: row.quantity,
            unitPrice: parseFloat(row.unit_price),
            totalPrice: parseFloat(row.total_price),
        };
    }
}
