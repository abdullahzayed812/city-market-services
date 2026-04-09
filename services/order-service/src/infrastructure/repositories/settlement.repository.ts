import { Pool, RowDataPacket, PoolConnection } from "mysql2/promise";
import { Settlement, SettlementStatus } from "../../core/entities/settlement.entity";
import { ISettlementRepository } from "../../core/interfaces/settlement.repository";
import { Database } from "@city-market/shared/node";

export class SettlementRepository implements ISettlementRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(settlement: Settlement, connection?: PoolConnection): Promise<Settlement> {
    const conn = connection || this.pool;
    const query = `
      INSERT INTO settlements (
        id, vendor_id, status, period_start, period_end,
        total_vendor_revenue, total_commission, net_payout,
        order_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.query(query, [
      settlement.id,
      settlement.vendorId,
      settlement.status,
      settlement.periodStart,
      settlement.periodEnd,
      settlement.totalVendorRevenue,
      settlement.totalCommission,
      settlement.netPayout,
      settlement.orderCount,
      settlement.notes || null,
    ]);
    return settlement;
  }

  async findById(id: string, connection?: PoolConnection): Promise<Settlement | null> {
    const conn = connection || this.pool;
    const query = "SELECT * FROM settlements WHERE id = ?";
    const [rows] = await conn.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByVendor(
    vendorId: string,
    limit: number,
    offset: number,
    connection?: PoolConnection,
  ): Promise<Settlement[]> {
    const conn = connection || this.pool;
    const query = `
      SELECT * FROM settlements 
      WHERE vendor_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await conn.query<RowDataPacket[]>(query, [vendorId, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async updateStatus(id: string, status: string, settledAt?: Date, connection?: PoolConnection): Promise<void> {
    const conn = connection || this.pool;
    const query = "UPDATE settlements SET status = ?, settled_at = ? WHERE id = ?";
    await conn.execute(query, [status, settledAt || null, id]);
  }

  async getPlatformOverview(connection?: PoolConnection): Promise<{
    totalPendingPayouts: number;
    totalSettledAmount: number;
    platformCommissionEarned: number;
  }> {
    const conn = connection || this.pool;

    // Total pending payouts: subtotal - platformCommission for all DELIVERED orders without settlement_id
    const pendingQuery = `
      SELECT SUM(subtotal - commission_amount) as totalPending
      FROM vendor_orders
      WHERE status = 'DELIVERED' AND settlement_id IS NULL
    `;

    // Total settled amount: net_payout for all PAID settlements
    const settledQuery = `
      SELECT SUM(net_payout) as totalSettled, SUM(total_commission) as totalCommission
      FROM settlements
      WHERE status = 'PAID'
    `;

    const [[pendingRow]] = await conn.execute<RowDataPacket[]>(pendingQuery);
    const [[settledRow]] = await conn.execute<RowDataPacket[]>(settledQuery);

    return {
      totalPendingPayouts: Number(parseFloat(pendingRow.totalPending || 0).toFixed(2)),
      totalSettledAmount: Number(parseFloat(settledRow.totalSettled || 0).toFixed(2)),
      platformCommissionEarned: Number(parseFloat(settledRow.totalCommission || 0).toFixed(2))
    };
  }

  private mapToEntity(row: any): Settlement {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      status: row.status as SettlementStatus,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalVendorRevenue: parseFloat(row.total_vendor_revenue),
      totalCommission: parseFloat(row.total_commission),
      netPayout: parseFloat(row.net_payout),
      orderCount: row.order_count,
      notes: row.notes,
      createdAt: row.created_at,
      settledAt: row.settled_at,
    };
  }
}
