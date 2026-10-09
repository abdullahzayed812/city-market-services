import { randomUUID } from "crypto";
import { PoolConnection } from "mysql2/promise";
import { IDeliveryOfficeSettlementRepository } from "../../core/interfaces/delivery-office-settlement.repository";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { DeliveryOfficeSettlement, OfficeSettlementStatus } from "../../core/entities/delivery-office-settlement.entity";
import { CreateOfficeSettlementDto, OfficePendingEarningsSummary } from "../../core/dto/delivery-office-settlement.dto";
import { Database } from "@city-market/shared/node";
import { ValidationError, NotFoundError, UnauthorizedError } from "@city-market/shared";
import { UserRole } from "@city-market/shared";

// M1: earnings belong to the office recorded on the delivery (d.delivery_office_id), not
// the courier's current office. Only office-fulfilled deliveries carry an office fee.
const OFFICE_DELIVERIES = `d.status = 'DELIVERED' AND d.office_settlement_id IS NULL
  AND d.delivery_office_id IS NOT NULL AND (d.fulfillment_type IS NULL OR d.fulfillment_type = 'OFFICE')`;

export class DeliveryOfficeSettlementService {
  constructor(
    private settlementRepo: IDeliveryOfficeSettlementRepository,
    private officeRepo: IDeliveryOfficeRepository,
    private deliveryRepo: IDeliveryRepository,
    private db: Database,
  ) {}

  private async resolveOfficeId(userId: string, role: UserRole): Promise<string | null> {
    if (role === UserRole.DELIVERY_MANAGER) {
      const office = await this.officeRepo.findByUserId(userId);
      if (!office) throw new NotFoundError("delivery_office_not_found");
      return office.id;
    }
    return null;
  }

  async getPendingEarnings(userId: string, role: UserRole, targetOfficeId?: string): Promise<OfficePendingEarningsSummary> {
    const pool = this.db.getPool();
    const officeId = role === UserRole.ADMIN ? (targetOfficeId ?? null) : await this.resolveOfficeId(userId, role);

    // No office (admin, all offices): the total across offices
    const [rows]: any = await pool.execute(
      `SELECT
         COUNT(*) as unsettledDeliveries,
         SUM(d.office_fee_amount) as totalDeliveryFees,
         MIN(d.delivered_at) as oldestUnsettledDeliveryDate
       FROM deliveries d
       WHERE ${OFFICE_DELIVERIES} ${officeId ? "AND d.delivery_office_id = ?" : ""}`,
      officeId ? [officeId] : [],
    );
    const row = rows[0];
    const totalDeliveryFees = Number(parseFloat(row.totalDeliveryFees || 0).toFixed(2));
    return {
      unsettledDeliveries: parseInt(row.unsettledDeliveries) || 0,
      totalDeliveryFees,
      netPayout: totalDeliveryFees,
      oldestUnsettledDeliveryDate: row.oldestUnsettledDeliveryDate ?? undefined,
    };
  }

  // With a deliveryOfficeId: one settlement for that office. Without: one settlement per
  // office that has unsettled deliveries in the period (M2), never one mixed settlement.
  async createSettlement(dto: CreateOfficeSettlementDto, userId: string, role: UserRole): Promise<DeliveryOfficeSettlement | DeliveryOfficeSettlement[]> {
    if (role !== UserRole.ADMIN) {
      throw new UnauthorizedError("only_admin_can_create_office_settlements");
    }

    const connection = await this.db.beginTransaction();
    try {
      // M6: lock the rows so a concurrent settlement can't include the same deliveries
      const [rows]: any = await connection.execute(
        `SELECT d.id, d.delivery_office_id, d.office_fee_amount FROM deliveries d
          WHERE ${OFFICE_DELIVERIES} ${dto.deliveryOfficeId ? "AND d.delivery_office_id = ?" : ""}
            AND COALESCE(d.delivered_at, d.updated_at) BETWEEN ? AND ?
          FOR UPDATE`,
        [...(dto.deliveryOfficeId ? [dto.deliveryOfficeId] : []), new Date(dto.periodStart), new Date(dto.periodEnd)],
      );

      if (rows.length === 0) {
        throw new ValidationError("no_qualifying_deliveries_for_settlement");
      }

      const byOffice = new Map<string, any[]>();
      for (const row of rows) {
        const list = byOffice.get(row.delivery_office_id) ?? [];
        list.push(row);
        byOffice.set(row.delivery_office_id, list);
      }

      const created: DeliveryOfficeSettlement[] = [];
      for (const [officeId, officeRows] of byOffice) {
        created.push(await this.createForOffice(officeId, officeRows, dto, connection));
      }

      await this.db.commit(connection);
      return dto.deliveryOfficeId ? created[0] : created;
    } catch (error) {
      await this.db.rollback(connection);
      throw error;
    }
  }

  private async createForOffice(officeId: string, rows: any[], dto: CreateOfficeSettlementDto, connection: PoolConnection): Promise<DeliveryOfficeSettlement> {
    const totalDeliveryFees = Number(rows.reduce((sum: number, r: any) => sum + parseFloat(r.office_fee_amount || 0), 0).toFixed(2));

    const settlement: DeliveryOfficeSettlement = {
      id: randomUUID(),
      deliveryOfficeId: officeId,
      status: OfficeSettlementStatus.PENDING,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      totalDeliveryFees,
      netPayout: totalDeliveryFees,
      deliveryCount: rows.length,
      notes: dto.notes,
      createdAt: new Date(),
    };

    const created = await this.settlementRepo.create(settlement, connection);
    const marked = await this.deliveryRepo.markDeliveriesAsOfficeSettled(
      rows.map((r: any) => r.id),
      created.id,
      connection,
    );
    if (marked !== rows.length) throw new ValidationError("deliveries_already_settled_retry");
    return created;
  }

  async getSettlements(userId: string, role: UserRole, limit = 10, offset = 0, targetOfficeId?: string): Promise<DeliveryOfficeSettlement[]> {
    if (role === UserRole.ADMIN) {
      if (targetOfficeId) return this.settlementRepo.findByOfficeId(targetOfficeId, limit, offset);
      return this.settlementRepo.findAll(limit, offset);
    }
    // DELIVERY_MANAGER can view their own office settlements (read-only)
    const officeId = await this.resolveOfficeId(userId, role);
    if (officeId) return this.settlementRepo.findByOfficeId(officeId, limit, offset);
    return [];
  }

  async markSettlementAsPaid(id: string, _userId: string, role: UserRole): Promise<void> {
    if (role !== UserRole.ADMIN) {
      throw new UnauthorizedError("only_admin_can_mark_office_settlement_paid");
    }
    const settlement = await this.settlementRepo.findById(id);
    if (!settlement) throw new NotFoundError("settlement_not_found");
    if (settlement.status === OfficeSettlementStatus.PAID) throw new ValidationError("settlement_already_paid");

    await this.settlementRepo.updateStatus(id, OfficeSettlementStatus.PAID, new Date());
  }
}
