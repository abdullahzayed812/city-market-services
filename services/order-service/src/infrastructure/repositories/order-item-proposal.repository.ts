import { Pool, RowDataPacket } from "mysql2/promise";
import { OrderItemProposal, ProposalType, ProposalStatus } from "../../core/entities/order-item-proposal.entity";
import { IOrderItemProposalRepository } from "../../core/interfaces/order-item-proposal.repository";
import { Database } from "@city-market/shared";

export class OrderItemProposalRepository implements IOrderItemProposalRepository {
    private pool: Pool;

    constructor(private db: Database) {
        this.pool = this.db.getPool();
    }

    async create(proposal: OrderItemProposal): Promise<OrderItemProposal> {
        const query = `
      INSERT INTO order_item_proposals (
        id, vendor_order_item_id, type, proposed_quantity, status
      ) VALUES (?, ?, ?, ?, ?)
    `;
        await this.pool.query(query, [
            proposal.id,
            proposal.vendorOrderItemId,
            proposal.type,
            proposal.proposedQuantity || null,
            proposal.status,
        ]);
        return proposal;
    }

    async findById(id: string): Promise<OrderItemProposal | null> {
        const query = "SELECT * FROM order_item_proposals WHERE id = ?";
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
        return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
    }

    async findByVendorOrderItem(vendorOrderItemId: string): Promise<OrderItemProposal[]> {
        const query = "SELECT * FROM order_item_proposals WHERE vendor_order_item_id = ?";
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [vendorOrderItemId]);
        return rows.map((row) => this.mapToEntity(row));
    }

    async findByVendorOrder(vendorOrderId: string): Promise<OrderItemProposal[]> {
        const query = `
            SELECT p.* 
            FROM order_item_proposals p
            JOIN vendor_order_items i ON p.vendor_order_item_id = i.id
            WHERE i.vendor_order_id = ?
        `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [vendorOrderId]);
        return rows.map((row) => this.mapToEntity(row));
    }

    async updateStatus(id: string, status: string): Promise<void> {
        const query = "UPDATE order_item_proposals SET status = ? WHERE id = ?";
        await this.pool.execute(query, [status, id]);
    }

    private mapToEntity(row: any): OrderItemProposal {
        return {
            id: row.id,
            vendorOrderItemId: row.vendor_order_item_id,
            type: row.type as ProposalType,
            proposedQuantity: row.proposed_quantity,
            status: row.status as ProposalStatus,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
