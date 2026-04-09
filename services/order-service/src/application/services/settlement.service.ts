import { ISettlementRepository } from "../../core/interfaces/settlement.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { Settlement, SettlementStatus } from "../../core/entities/settlement.entity";
import { CreateSettlementDto, PendingEarningsSummary, PlatformFinancialOverview } from "../../core/dto/settlement.dto";
import { Database } from "@city-market/shared/node";
import { randomUUID } from "crypto";
import { ValidationError, NotFoundError } from "@city-market/shared";

export class SettlementService {
  constructor(
    private settlementRepo: ISettlementRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private db: Database,
  ) {}

  async getVendorPendingEarnings(vendorId: string): Promise<PendingEarningsSummary> {
    // We need a helper in vendorOrderRepo to get pending (DELIVERED and settlement_id IS NULL)
    const summary = await this.getPendingOrdersSummary(vendorId);
    return summary;
  }

  async createSettlement(dto: CreateSettlementDto): Promise<Settlement> {
    const connection = await this.db.beginTransaction();

    try {
      // 1. Fetch all DELIVERED, unsettled vendor_orders for this vendor in the range
      // We need a specialized query for this in vendorOrderRepo
      const orders = await this.getDeliveredUnsettledOrders(dto.vendorId, dto.periodStart, dto.periodEnd, connection);

      if (orders.length === 0) {
        throw new ValidationError("no_qualifying_orders_for_settlement");
      }

      const totalVendorRevenue = Number(orders.reduce((sum, o) => sum + +o.subtotal, 0).toFixed(2));
      const totalCommission = Number(orders.reduce((sum, o) => sum + +o.commissionAmount, 0).toFixed(2));
      const netPayout = Number((totalVendorRevenue - totalCommission).toFixed(2));

      const settlement: Settlement = {
        id: randomUUID(),
        vendorId: dto.vendorId,
        status: SettlementStatus.PENDING,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        totalVendorRevenue,
        totalCommission,
        netPayout,
        orderCount: orders.length,
        notes: dto.notes,
        createdAt: new Date(),
      };

      const created = await this.settlementRepo.create(settlement, connection);

      // 2. Batch update vendor_orders.settlement_id
      const orderIds = orders.map((o) => o.id);
      await this.vendorOrderRepo.markOrdersAsSettled(orderIds, created.id, connection);

      await this.db.commit(connection);
      return created;
    } catch (error) {
      await this.db.rollback(connection);
      throw error;
    } finally {
      // connection already released by commit/rollback in my Database helper
    }
  }

  async getSettlements(vendorId?: string, limit = 10, offset = 0): Promise<Settlement[]> {
    if (vendorId) {
      return this.settlementRepo.findByVendor(vendorId, limit, offset);
    }
    // Need a findAll if periodStart not provided, or just use findByVendor logic with empty vendorId if supported
    // For now let's assume always per vendor or platform overview
    return [];
  }

  async markSettlementAsPaid(id: string): Promise<void> {
    const settlement = await this.settlementRepo.findById(id);
    if (!settlement) throw new NotFoundError("settlement_not_found");
    if (settlement.status === SettlementStatus.PAID) throw new ValidationError("settlement_already_paid");

    await this.settlementRepo.updateStatus(id, SettlementStatus.PAID, new Date());
  }

  async getPlatformFinancialOverview(): Promise<PlatformFinancialOverview> {
    return this.settlementRepo.getPlatformOverview();
  }

  // Helper methods that should probably be in vendorOrderRepo but I'll add them here or update repo
  private async getPendingOrdersSummary(vendorId: string): Promise<PendingEarningsSummary> {
    const pool = this.db.getPool();
    const query = `
            SELECT 
                COUNT(*) as unsettledOrders,
                SUM(subtotal) as totalRevenue,
                SUM(commission_amount) as totalCommission,
                MIN(created_at) as oldestUnsettledOrderDate
            FROM vendor_orders
            WHERE vendor_id = ? AND status = 'DELIVERED' AND settlement_id IS NULL
        `;
    const [rows]: any = await pool.execute(query, [vendorId]);
    const row = rows[0];

    const totalRevenue = Number(parseFloat(row.totalRevenue || 0).toFixed(2));
    const totalCommission = Number(parseFloat(row.totalCommission || 0).toFixed(2));

    return {
      vendorId,
      unsettledOrders: parseInt(row.unsettledOrders) || 0,
      totalRevenue,
      totalCommission,
      netPayout: Number((totalRevenue - totalCommission).toFixed(2)),
      oldestUnsettledOrderDate: row.oldestUnsettledOrderDate,
    };
  }

  private async getDeliveredUnsettledOrders(
    vendorId: string,
    start: Date,
    end: Date,
    connection: any,
  ): Promise<VendorOrder[]> {
    const query = `
            SELECT * FROM vendor_orders
            WHERE vendor_id = ? AND status = 'DELIVERED' AND settlement_id IS NULL
            AND created_at BETWEEN ? AND ?
        `;
    const [rows]: any = await connection.execute(query, [vendorId, start, end]);
    return rows.map((row: any) => this.vendorOrderRepo.mapToEntity(row));
  }
}
