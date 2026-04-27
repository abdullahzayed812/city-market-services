import { Pool, PoolConnection } from "mysql2/promise";
import { CourierSettlement, CourierSettlementStatus } from "../../core/entities/courier-settlement.entity";
import { ICourierSettlementRepository } from "../../core/interfaces/courier-settlement.repository";
import { Database } from "@city-market/shared/node";

export class CourierSettlementRepository implements ICourierSettlementRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(settlement: CourierSettlement, connection?: PoolConnection): Promise<CourierSettlement> {
    const conn = connection || this.pool;
    await (conn as any).query(
      `INSERT INTO courier_settlements
         (id, courier_id, status, period_start, period_end, total_delivery_fees, net_payout, delivery_count, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        settlement.id,
        settlement.courierId,
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

  async findById(id: string, connection?: PoolConnection): Promise<CourierSettlement | null> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).execute(
      "SELECT * FROM courier_settlements WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByCourier(courierId: string, limit: number, offset: number, connection?: PoolConnection): Promise<CourierSettlement[]> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).query(
      "SELECT * FROM courier_settlements WHERE courier_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [courierId, limit, offset],
    );
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: PoolConnection): Promise<CourierSettlement[]> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).query(
      `SELECT cs.* FROM courier_settlements cs
       INNER JOIN couriers c ON c.id = cs.courier_id
       WHERE c.delivery_office_id = ?
       ORDER BY cs.created_at DESC LIMIT ? OFFSET ?`,
      [deliveryOfficeId, limit, offset],
    );
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async findAll(limit: number, offset: number, connection?: PoolConnection): Promise<CourierSettlement[]> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).query(
      "SELECT * FROM courier_settlements ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async updateStatus(id: string, status: string, settledAt?: Date, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    await (conn as any).execute(
      "UPDATE courier_settlements SET status = ?, settled_at = ? WHERE id = ?",
      [status, settledAt || null, id],
    );
  }

  async getPlatformOverview(connection?: PoolConnection): Promise<{
    totalPendingPayouts: number;
    totalSettledAmount: number;
    totalDeliveryFees: number;
  }> {
    const conn = connection || this.pool;
    const [[pendingRow]] = await (conn as any).execute(
      `SELECT SUM(total_price) as totalPending
       FROM deliveries
       WHERE status = 'DELIVERED' AND courier_settlement_id IS NULL`,
    );
    const [[settledRow]] = await (conn as any).execute(
      `SELECT SUM(net_payout) as totalSettled, SUM(total_delivery_fees) as totalFees
       FROM courier_settlements
       WHERE status = 'PAID'`,
    );
    return {
      totalPendingPayouts: Number(parseFloat(pendingRow.totalPending || 0).toFixed(2)),
      totalSettledAmount: Number(parseFloat(settledRow.totalSettled || 0).toFixed(2)),
      totalDeliveryFees: Number(parseFloat(settledRow.totalFees || 0).toFixed(2)),
    };
  }

  private mapToEntity(row: any): CourierSettlement {
    return {
      id: row.id,
      courierId: row.courier_id,
      status: row.status as CourierSettlementStatus,
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
