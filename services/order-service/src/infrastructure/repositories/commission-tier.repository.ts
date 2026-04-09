import { Pool, RowDataPacket } from "mysql2/promise";
import { Database } from "@city-market/shared/node";
import { CommissionTier } from "../../core/entities/commission-tier.entity";
import { ICommissionTierRepository } from "../../core/interfaces/commission-tier.repository";

export class CommissionTierRepository implements ICommissionTierRepository {
    private pool: Pool;

    constructor(private db: Database) {
        this.pool = this.db.getPool();
    }

    async findAll(): Promise<CommissionTier[]> {
        const query = "SELECT * FROM commission_tiers ORDER BY min_amount ASC";
        const [rows] = await this.pool.query<RowDataPacket[]>(query);
        return rows.map((row) => this.mapToEntity(row));
    }

    async findById(id: string): Promise<CommissionTier | null> {
        const query = "SELECT * FROM commission_tiers WHERE id = ?";
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
        return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
    }

    async create(tier: CommissionTier): Promise<void> {
        const query = `
      INSERT INTO commission_tiers (id, min_amount, max_amount, percentage)
      VALUES (?, ?, ?, ?)
    `;
        await this.pool.execute(query, [
            tier.id,
            tier.minAmount,
            tier.maxAmount,
            tier.percentage,
        ]);
    }

    async update(id: string, data: Partial<CommissionTier>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.minAmount !== undefined) {
            fields.push("min_amount = ?");
            values.push(data.minAmount);
        }
        if (data.maxAmount !== undefined) {
            fields.push("max_amount = ?");
            values.push(data.maxAmount);
        }
        if (data.percentage !== undefined) {
            fields.push("percentage = ?");
            values.push(data.percentage);
        }

        if (fields.length === 0) return;

        values.push(id);
        const query = `UPDATE commission_tiers SET ${fields.join(", ")} WHERE id = ?`;
        await this.pool.execute(query, values);
    }

    async delete(id: string): Promise<void> {
        const query = "DELETE FROM commission_tiers WHERE id = ?";
        await this.pool.execute(query, [id]);
    }

    async findByAmount(amount: number): Promise<CommissionTier | null> {
        const query = `
      SELECT * FROM commission_tiers 
      WHERE min_amount <= ? AND (max_amount > ? OR max_amount IS NULL)
      LIMIT 1
    `;
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, [amount, amount]);
        return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
    }

    private mapToEntity(row: any): CommissionTier {
        return {
            id: row.id,
            minAmount: parseFloat(row.min_amount),
            maxAmount: row.max_amount ? parseFloat(row.max_amount) : null,
            percentage: parseFloat(row.percentage),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
