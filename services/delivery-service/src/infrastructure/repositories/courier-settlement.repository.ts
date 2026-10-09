import { Pool, PoolConnection } from "mysql2/promise";
import { CourierSettlement, CourierSettlementStatus } from "../../core/entities/courier-settlement.entity";
import { ICourierSettlementRepository } from "../../core/interfaces/courier-settlement.repository";
import { Database } from "@city-market/shared/node";
import { DeliveryPlatformOverview } from "../../core/dto/courier-settlement.dto";

export class CourierSettlementRepository implements ICourierSettlementRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(settlement: CourierSettlement, connection?: PoolConnection): Promise<CourierSettlement> {
    const conn = connection || this.pool;
    await (conn as any).query(
      `INSERT INTO courier_settlements
         (id, courier_id, status, period_start, period_end, total_delivery_fees, total_cash_collected, net_payout, delivery_count, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        settlement.id,
        settlement.courierId,
        settlement.status,
        settlement.periodStart,
        settlement.periodEnd,
        settlement.totalDeliveryFees,
        settlement.totalCashCollected,
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
      `SELECT cs.*, c.full_name as courier_name FROM courier_settlements cs
       INNER JOIN couriers c ON c.id = cs.courier_id
       WHERE cs.courier_id = ?
       ORDER BY cs.created_at DESC LIMIT ? OFFSET ?`,
      [courierId, limit, offset],
    );
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: PoolConnection): Promise<CourierSettlement[]> {
    const conn = connection || this.pool;
    const [rows] = await (conn as any).query(
      `SELECT cs.*, c.full_name as courier_name FROM courier_settlements cs
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
      `SELECT cs.*, c.full_name as courier_name FROM courier_settlements cs
       INNER JOIN couriers c ON c.id = cs.courier_id
       ORDER BY cs.created_at DESC LIMIT ? OFFSET ?`,
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

  // M5: payouts are courier fees, not goods value (total_price)
  async getPlatformOverview(connection?: PoolConnection): Promise<DeliveryPlatformOverview> {
    const conn = connection || this.pool;
    const [[pendingRow]] = await (conn as any).execute(
      `SELECT
         SUM(CASE WHEN courier_settlement_id IS NULL THEN courier_fee_amount ELSE 0 END) AS pendingCourier,
         SUM(CASE WHEN courier_settlement_id IS NULL AND fulfillment_type = 'FREELANCE' THEN courier_fee_amount ELSE 0 END) AS pendingFreelanceCourier,
         SUM(CASE WHEN office_settlement_id IS NULL AND delivery_office_id IS NOT NULL THEN office_fee_amount ELSE 0 END) AS pendingOffice,
         SUM(CASE WHEN courier_settlement_id IS NULL THEN cash_collected_amount ELSE 0 END) AS pendingCash,
         SUM(delivery_fee) AS totalFees,
         SUM(platform_fee_amount) AS platformRevenue
       FROM deliveries
       WHERE status = 'DELIVERED'`,
    );
    const [[settledRow]] = await (conn as any).execute(
      `SELECT SUM(net_payout) as totalSettled FROM courier_settlements WHERE status = 'PAID'`,
    );
    const pendingCourier = Number(parseFloat(pendingRow.pendingCourier || 0).toFixed(2));
    const pendingFreelance = Number(parseFloat(pendingRow.pendingFreelanceCourier || 0).toFixed(2));
    return {
      totalPendingPayouts: pendingCourier,
      pendingOfficeCourierPayouts: Number((pendingCourier - pendingFreelance).toFixed(2)),
      pendingFreelanceCourierPayouts: pendingFreelance,
      pendingOfficePayouts: Number(parseFloat(pendingRow.pendingOffice || 0).toFixed(2)),
      pendingCashHeldByCouriers: Number(parseFloat(pendingRow.pendingCash || 0).toFixed(2)),
      totalSettledAmount: Number(parseFloat(settledRow.totalSettled || 0).toFixed(2)),
      totalDeliveryFees: Number(parseFloat(pendingRow.totalFees || 0).toFixed(2)),
      platformRevenue: Number(parseFloat(pendingRow.platformRevenue || 0).toFixed(2)),
    };
  }

  private mapToEntity(row: any): CourierSettlement {
    return {
      id: row.id,
      courierId: row.courier_id,
      courierName: row.courier_name,
      status: row.status as CourierSettlementStatus,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalDeliveryFees: parseFloat(row.total_delivery_fees),
      totalCashCollected: parseFloat(row.total_cash_collected || 0),
      netPayout: parseFloat(row.net_payout),
      deliveryCount: row.delivery_count,
      notes: row.notes,
      createdAt: row.created_at,
      settledAt: row.settled_at,
    };
  }
}
