import { Pool, PoolConnection } from "mysql2/promise";
import { DeliveryOfficeSettlement, OfficeSettlementStatus } from "../../core/entities/delivery-office-settlement.entity";
import { IDeliveryOfficeSettlementRepository } from "../../core/interfaces/delivery-office-settlement.repository";
import { Database } from "@city-market/shared/node";

export class DeliveryOfficeSettlementRepository implements IDeliveryOfficeSettlementRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(settlement: DeliveryOfficeSettlement, connection?: PoolConnection): Promise<DeliveryOfficeSettlement> {
    const conn = connection || this.pool;
    await (conn as any).query(
      `INSERT INTO delivery_office_settlements
         (id, delivery_office_id, status, period_start, period_end, total_delivery_fees, net_payout, delivery_count, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        settlement.id,
        settlement.deliveryOfficeId || null,
        settlement.status,
        settlement.periodStart,
        settlement.periodEnd,
        settlement.totalDeliveryFees,
        settlement.netPayout,
        settlement.deliveryCount,
        settlement.notes || null,
      ],
    );
    return settlement;
  }

  async findById(id: string, connection?: PoolConnection): Promise<DeliveryOfficeSettlement | null> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).execute(
      "SELECT * FROM delivery_office_settlements WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findAll(limit: number, offset: number, connection?: PoolConnection): Promise<DeliveryOfficeSettlement[]> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).query(
      "SELECT * FROM delivery_office_settlements ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: PoolConnection): Promise<DeliveryOfficeSettlement[]> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).query(
      "SELECT * FROM delivery_office_settlements WHERE delivery_office_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [deliveryOfficeId, limit, offset],
    );
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async updateStatus(id: string, status: string, settledAt?: Date, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await (conn as any).execute(
      "UPDATE delivery_office_settlements SET status = ?, settled_at = ? WHERE id = ?",
      [status, settledAt || null, id],
    );
  }

  private mapToEntity(row: any): DeliveryOfficeSettlement {
    return {
      id: row.id,
      deliveryOfficeId: row.delivery_office_id ?? undefined,
      status: row.status as OfficeSettlementStatus,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalDeliveryFees: parseFloat(row.total_delivery_fees),
      netPayout: parseFloat(row.net_payout),
      deliveryCount: row.delivery_count,
      notes: row.notes,
      createdAt: row.created_at,
      settledAt: row.settled_at,
    };
  }
}
