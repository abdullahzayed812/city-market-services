import { randomUUID } from "crypto";
import { ICourierSettlementRepository } from "../../core/interfaces/courier-settlement.repository";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { CourierSettlement, CourierSettlementStatus } from "../../core/entities/courier-settlement.entity";
import {
  CreateCourierSettlementDto,
  CourierPendingEarningsSummary,
  DeliveryPlatformOverview,
} from "../../core/dto/courier-settlement.dto";
import { Database } from "@city-market/shared/node";
import { ValidationError, NotFoundError, UnauthorizedError, UserRole } from "@city-market/shared";

export class CourierSettlementService {
  constructor(
    private settlementRepo: ICourierSettlementRepository,
    private deliveryRepo: IDeliveryRepository,
    private officeRepo: IDeliveryOfficeRepository,
    private courierRepo: ICourierRepository,
    private db: Database,
  ) {}

  private async resolveOfficeId(userId: string): Promise<string> {
    const office = await this.officeRepo.findByUserId(userId);
    if (!office) throw new NotFoundError("delivery_office_not_found");
    return office.id;
  }

  private async resolveCourierId(userId: string): Promise<string> {
    const courier = await this.courierRepo.findByUserId(userId);
    if (!courier) throw new NotFoundError("courier_not_found");
    return courier.id;
  }

  async getCourierPendingEarnings(courierId: string): Promise<CourierPendingEarningsSummary> {
    const pool = this.db.getPool();
    const [rows]: any = await pool.execute(
      `SELECT
         COUNT(*) as unsettledDeliveries,
         SUM(courier_fee_amount) as totalDeliveryFees,
         MIN(delivered_at) as oldestUnsettledDeliveryDate
       FROM deliveries
       WHERE courier_id = ? AND status = 'DELIVERED' AND courier_settlement_id IS NULL`,
      [courierId],
    );
    const row = rows[0];
    const totalDeliveryFees = Number(parseFloat(row.totalDeliveryFees || 0).toFixed(2));
    return {
      courierId,
      unsettledDeliveries: parseInt(row.unsettledDeliveries) || 0,
      totalDeliveryFees,
      netPayout: totalDeliveryFees,
      oldestUnsettledDeliveryDate: row.oldestUnsettledDeliveryDate ?? undefined,
    };
  }

  async createSettlement(dto: CreateCourierSettlementDto, userId: string, role: UserRole): Promise<CourierSettlement> {
    if (role === UserRole.DELIVERY_MANAGER) {
      const officeId = await this.resolveOfficeId(userId);
      const courier = await this.courierRepo.findById(dto.courierId);
      if (!courier) throw new NotFoundError("courier_not_found");
      if (courier.deliveryOfficeId !== officeId) {
        throw new UnauthorizedError("courier_not_in_your_office");
      }
    }

    const connection = await this.db.beginTransaction();
    try {
      const [rows]: any = await connection.execute(
        `SELECT id, courier_fee_amount FROM deliveries
         WHERE courier_id = ? AND status = 'DELIVERED' AND courier_settlement_id IS NULL
           AND delivered_at BETWEEN ? AND ?`,
        [dto.courierId, new Date(dto.periodStart), new Date(dto.periodEnd)],
      );

      if (rows.length === 0) {
        throw new ValidationError("no_qualifying_deliveries_for_settlement");
      }

      const totalDeliveryFees = Number(
        rows.reduce((sum: number, r: any) => sum + parseFloat(r.courier_fee_amount || 0), 0).toFixed(2),
      );

      const settlement: CourierSettlement = {
        id: randomUUID(),
        courierId: dto.courierId,
        status: CourierSettlementStatus.PENDING,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        totalDeliveryFees,
        netPayout: totalDeliveryFees,
        deliveryCount: rows.length,
        notes: dto.notes,
        createdAt: new Date(),
      };

      const created = await this.settlementRepo.create(settlement, connection);
      await this.deliveryRepo.markDeliveriesAsCourierSettled(
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

  async getAllCouriersPendingEarnings(userId: string, role: UserRole): Promise<CourierPendingEarningsSummary[]> {
    const pool = this.db.getPool();

    let query: string;
    let params: any[];

    if (role === UserRole.DELIVERY_MANAGER) {
      const officeId = await this.resolveOfficeId(userId);
      query = `SELECT
         c.id as courierId,
         c.full_name as courierName,
         COUNT(d.id) as unsettledDeliveries,
         COALESCE(SUM(d.courier_fee_amount), 0) as totalDeliveryFees,
         MIN(d.delivered_at) as oldestUnsettledDeliveryDate
       FROM couriers c
       LEFT JOIN deliveries d
         ON d.courier_id = c.id AND d.status = 'DELIVERED' AND d.courier_settlement_id IS NULL
       WHERE c.delivery_office_id = ?
       GROUP BY c.id, c.full_name
       HAVING COUNT(d.id) > 0
       ORDER BY totalDeliveryFees DESC`;
      params = [officeId];
    } else {
      query = `SELECT
         c.id as courierId,
         c.full_name as courierName,
         COUNT(d.id) as unsettledDeliveries,
         COALESCE(SUM(d.courier_fee_amount), 0) as totalDeliveryFees,
         MIN(d.delivered_at) as oldestUnsettledDeliveryDate
       FROM couriers c
       LEFT JOIN deliveries d
         ON d.courier_id = c.id AND d.status = 'DELIVERED' AND d.courier_settlement_id IS NULL
       GROUP BY c.id, c.full_name
       HAVING COUNT(d.id) > 0
       ORDER BY totalDeliveryFees DESC`;
      params = [];
    }

    const [rows]: any = await pool.execute(query, params);
    return rows.map((row: any) => ({
      courierId: row.courierId,
      courierName: row.courierName,
      unsettledDeliveries: parseInt(row.unsettledDeliveries) || 0,
      totalDeliveryFees: Number(parseFloat(row.totalDeliveryFees || 0).toFixed(2)),
      netPayout: Number(parseFloat(row.totalDeliveryFees || 0).toFixed(2)),
      oldestUnsettledDeliveryDate: row.oldestUnsettledDeliveryDate ?? undefined,
    }));
  }

  async getSettlements(userId: string, role: UserRole, courierId?: string, limit = 10, offset = 0): Promise<CourierSettlement[]> {
    if (role === UserRole.COURIER) {
      const resolvedCourierId = await this.resolveCourierId(userId);
      return this.settlementRepo.findByCourier(resolvedCourierId, limit, offset);
    }

    if (role === UserRole.DELIVERY_MANAGER) {
      const officeId = await this.resolveOfficeId(userId);
      if (courierId) {
        const courier = await this.courierRepo.findById(courierId);
        if (!courier || courier.deliveryOfficeId !== officeId) {
          throw new UnauthorizedError("courier_not_in_your_office");
        }
        return this.settlementRepo.findByCourier(courierId, limit, offset);
      }
      return this.settlementRepo.findByOfficeId(officeId, limit, offset);
    }

    if (courierId) {
      return this.settlementRepo.findByCourier(courierId, limit, offset);
    }
    return this.settlementRepo.findAll(limit, offset);
  }

  async markSettlementAsPaid(id: string, userId: string, role: UserRole): Promise<void> {
    const settlement = await this.settlementRepo.findById(id);
    if (!settlement) throw new NotFoundError("settlement_not_found");
    if (settlement.status === CourierSettlementStatus.PAID) throw new ValidationError("settlement_already_paid");

    if (role === UserRole.DELIVERY_MANAGER) {
      const officeId = await this.resolveOfficeId(userId);
      const courier = await this.courierRepo.findById(settlement.courierId);
      if (!courier || courier.deliveryOfficeId !== officeId) {
        throw new UnauthorizedError("settlement_not_owned_by_your_office");
      }
    }

    await this.settlementRepo.updateStatus(id, CourierSettlementStatus.PAID, new Date());
  }

  async getPlatformOverview(): Promise<DeliveryPlatformOverview> {
    return this.settlementRepo.getPlatformOverview();
  }
}
