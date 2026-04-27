import { randomUUID } from "crypto";
import { IDeliveryOfficeSettlementRepository } from "../../core/interfaces/delivery-office-settlement.repository";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { DeliveryOfficeSettlement, OfficeSettlementStatus } from "../../core/entities/delivery-office-settlement.entity";
import { CreateOfficeSettlementDto, OfficePendingEarningsSummary } from "../../core/dto/delivery-office-settlement.dto";
import { Database } from "@city-market/shared/node";
import { ValidationError, NotFoundError, UnauthorizedError } from "@city-market/shared";
import { UserRole } from "@city-market/shared";

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

    let query: string;
    let params: any[];

    if (officeId) {
      query = `SELECT
         COUNT(*) as unsettledDeliveries,
         SUM(d.delivery_fee - d.courier_fee_amount) as totalDeliveryFees,
         MIN(d.delivered_at) as oldestUnsettledDeliveryDate
       FROM deliveries d
       INNER JOIN couriers c ON c.id = d.courier_id
       WHERE d.status = 'DELIVERED' AND d.office_settlement_id IS NULL
         AND c.delivery_office_id = ?`;
      params = [officeId];
    } else {
      query = `SELECT
         COUNT(*) as unsettledDeliveries,
         SUM(delivery_fee - courier_fee_amount) as totalDeliveryFees,
         MIN(delivered_at) as oldestUnsettledDeliveryDate
       FROM deliveries
       WHERE status = 'DELIVERED' AND office_settlement_id IS NULL`;
      params = [];
    }

    const [rows]: any = await pool.execute(query, params);
    const row = rows[0];
    const totalDeliveryFees = Number(parseFloat(row.totalDeliveryFees || 0).toFixed(2));
    return {
      unsettledDeliveries: parseInt(row.unsettledDeliveries) || 0,
      totalDeliveryFees,
      netPayout: totalDeliveryFees,
      oldestUnsettledDeliveryDate: row.oldestUnsettledDeliveryDate ?? undefined,
    };
  }

  async createSettlement(dto: CreateOfficeSettlementDto, userId: string, role: UserRole): Promise<DeliveryOfficeSettlement> {
    let officeId: string | undefined;

    if (role === UserRole.DELIVERY_MANAGER) {
      const resolved = await this.resolveOfficeId(userId, role);
      officeId = resolved ?? undefined;
    } else if (dto.deliveryOfficeId) {
      officeId = dto.deliveryOfficeId;
    }

    const connection = await this.db.beginTransaction();
    try {
      let query: string;
      let params: any[];

      if (officeId) {
        query = `SELECT d.id, (d.delivery_fee - d.courier_fee_amount) as office_fee FROM deliveries d
           INNER JOIN couriers c ON c.id = d.courier_id
           WHERE d.status = 'DELIVERED' AND d.office_settlement_id IS NULL
             AND c.delivery_office_id = ?
             AND d.delivered_at BETWEEN ? AND ?`;
        params = [officeId, new Date(dto.periodStart), new Date(dto.periodEnd)];
      } else {
        query = `SELECT id, (delivery_fee - courier_fee_amount) as office_fee FROM deliveries
           WHERE status = 'DELIVERED' AND office_settlement_id IS NULL
             AND delivered_at BETWEEN ? AND ?`;
        params = [new Date(dto.periodStart), new Date(dto.periodEnd)];
      }

      const [rows]: any = await connection.execute(query, params);

      if (rows.length === 0) {
        throw new ValidationError("no_qualifying_deliveries_for_settlement");
      }

      const totalDeliveryFees = Number(
        rows.reduce((sum: number, r: any) => sum + parseFloat(r.office_fee || 0), 0).toFixed(2),
      );

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
      await this.deliveryRepo.markDeliveriesAsOfficeSettled(
        rows.map((r: any) => r.id),
        created.id,
        connection,
      );

      await this.db.commit(connection);
      return created;
    } catch (error) {
      await this.db.rollback(connection);
      throw error;
    }
  }

  async getSettlements(userId: string, role: UserRole, limit = 10, offset = 0, targetOfficeId?: string): Promise<DeliveryOfficeSettlement[]> {
    if (role === UserRole.ADMIN) {
      if (targetOfficeId) return this.settlementRepo.findByOfficeId(targetOfficeId, limit, offset);
      return this.settlementRepo.findAll(limit, offset);
    }
    const officeId = await this.resolveOfficeId(userId, role);
    if (officeId) return this.settlementRepo.findByOfficeId(officeId, limit, offset);
    return this.settlementRepo.findAll(limit, offset);
  }

  async markSettlementAsPaid(id: string, userId: string, role: UserRole): Promise<void> {
    const settlement = await this.settlementRepo.findById(id);
    if (!settlement) throw new NotFoundError("settlement_not_found");
    if (settlement.status === OfficeSettlementStatus.PAID) throw new ValidationError("settlement_already_paid");

    if (role === UserRole.DELIVERY_MANAGER) {
      const officeId = await this.resolveOfficeId(userId, role);
      if (settlement.deliveryOfficeId !== officeId) {
        throw new UnauthorizedError("settlement_not_owned_by_your_office");
      }
    }

    await this.settlementRepo.updateStatus(id, OfficeSettlementStatus.PAID, new Date());
  }
}
