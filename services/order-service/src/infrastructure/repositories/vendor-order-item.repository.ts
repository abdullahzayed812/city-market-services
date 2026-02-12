import { Pool, RowDataPacket } from "mysql2/promise";
import { VendorOrderItem } from "../../core/entities/vendor-order-item.entity";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { Database } from "@city-market/shared";

export class VendorOrderItemRepository implements IVendorOrderItemRepository {
    private pool: Pool;

    constructor(private db: Database) {
        this.pool = this.db.getPool();
    }

    async create(item: VendorOrderItem): Promise<VendorOrderItem> {
        const query = `
      INSERT INTO vendor_order_items (
        id, vendor_order_id, product_id, product_name,
        quantity, unit_price, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
        await this.pool.query(query, [
            item.id,
            item.vendorOrderId,
            item.productId,
            item.productName,
            item.quantity,
            item.unitPrice,
            item.totalPrice,
        ]);
        return item;
    }

    async findByVendorOrder(vendorOrderId: string): Promise<VendorOrderItem[]> {
        const query = "SELECT * FROM vendor_order_items WHERE vendor_order_id = ?";
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [vendorOrderId]);
        return rows.map((row) => this.mapToEntity(row));
    }

    async findById(id: string): Promise<VendorOrderItem | null> {
        const query = "SELECT * FROM vendor_order_items WHERE id = ?";
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
        return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
    }

    private mapToEntity(row: any): VendorOrderItem {
        return {
            id: row.id,
            vendorOrderId: row.vendor_order_id,
            productId: row.product_id,
            productName: row.product_name,
            quantity: row.quantity,
            unitPrice: parseFloat(row.unit_price),
            totalPrice: parseFloat(row.total_price),
        };
    }
}
