import { randomUUID } from "crypto";
import { ICourierSettlementRepository } from "../../core/interfaces/courier-settlement.repository";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { Courier } from "../../core/entities/courier.entity";
import { CourierSettlement, CourierSettlementStatus } from "../../core/entities/courier-settlement.entity";
import { CreateCourierSettlementDto, CourierPendingEarningsSummary, DeliveryPlatformOverview } from "../../core/dto/courier-settlement.dto";
import { Database } from "@city-market/shared/node";
import { ValidationError, NotFoundError, UnauthorizedError, UserRole } from "@city-market/shared";

const money = (value: any) => Number(parseFloat(value || 0).toFixed(2));

// Which of a courier's deliveries a settlement covers, and whether cash is netted.
//  - Office manager: only deliveries their office handled (M4). Cash stays between the
//    office and its courier, as before.
//  - Admin, freelancer: freelance deliveries; the cash they collected is netted (§3.6),
//    so net_payout can go negative when the freelancer owes the platform.
//  - Admin, office courier: office-fulfilled deliveries, no netting.
interface SettlementScope {
  clause: string;
  params: any[];
  netsCash: boolean;
}

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

  private async scopeFor(courier: Courier, userId: string, role: UserRole): Promise<SettlementScope> {
    if (role === UserRole.DELIVERY_MANAGER) {
      const officeId = await this.resolveOfficeId(userId);
      // Freelancers are settled by admins only
      if (courier.courierType !== "OFFICE" || courier.deliveryOfficeId !== officeId) {
        throw new UnauthorizedError("courier_not_in_your_office");
      }
      return { clause: "AND d.delivery_office_id = ?", params: [officeId], netsCash: false };
    }
    if (courier.courierType === "FREELANCE") {
      return { clause: "AND d.fulfillment_type = 'FREELANCE'", params: [], netsCash: true };
    }
    return { clause: "AND (d.fulfillment_type IS NULL OR d.fulfillment_type = 'OFFICE')", params: [], netsCash: false };
  }

  private async requireCourier(courierId: string): Promise<Courier> {
    const courier = await this.courierRepo.findById(courierId);
    if (!courier) throw new NotFoundError("courier_not_found");
    return courier;
  }

  async getCourierPendingEarnings(courierId: string, userId: string, role: UserRole): Promise<CourierPendingEarningsSummary> {
    const courier = await this.requireCourier(courierId);
    let scope: SettlementScope;
    if (role === UserRole.COURIER) {
      // A courier sees only their own earnings, across everything they delivered
      if (courier.userId !== userId) throw new UnauthorizedError("not_your_courier_profile");
      scope = { clause: "", params: [], netsCash: courier.courierType === "FREELANCE" };
    } else {
      scope = await this.scopeFor(courier, userId, role);
    }

    const [rows]: any = await this.db.getPool().execute(
      `SELECT
         COUNT(*) as unsettledDeliveries,
         SUM(d.courier_fee_amount) as totalDeliveryFees,
         SUM(d.cash_collected_amount) as totalCashCollected,
         MIN(d.delivered_at) as oldestUnsettledDeliveryDate
       FROM deliveries d
       WHERE d.courier_id = ? AND d.status = 'DELIVERED' AND d.courier_settlement_id IS NULL ${scope.clause}`,
      [courierId, ...scope.params],
    );
    const row = rows[0];
    const totalDeliveryFees = money(row.totalDeliveryFees);
    const totalCashCollected = money(row.totalCashCollected);
    return {
      courierId,
      courierName: courier.fullName,
      courierType: courier.courierType,
      unsettledDeliveries: parseInt(row.unsettledDeliveries) || 0,
      totalDeliveryFees,
      totalCashCollected,
      netPayout: scope.netsCash ? money(totalDeliveryFees - totalCashCollected) : totalDeliveryFees,
      oldestUnsettledDeliveryDate: row.oldestUnsettledDeliveryDate ?? undefined,
    };
  }

  async createSettlement(dto: CreateCourierSettlementDto, userId: string, role: UserRole): Promise<CourierSettlement> {
    const courier = await this.requireCourier(dto.courierId);
    const scope = await this.scopeFor(courier, userId, role);

    const connection = await this.db.beginTransaction();
    try {
      // M6: lock the rows so a concurrent settlement can't include the same deliveries
      const [rows]: any = await connection.execute(
        `SELECT d.id, d.courier_fee_amount, d.cash_collected_amount FROM deliveries d
         WHERE d.courier_id = ? AND d.status = 'DELIVERED' AND d.courier_settlement_id IS NULL
           AND COALESCE(d.delivered_at, d.updated_at) BETWEEN ? AND ? ${scope.clause}
         FOR UPDATE`,
        [dto.courierId, new Date(dto.periodStart), new Date(dto.periodEnd), ...scope.params],
      );

      if (rows.length === 0) {
        throw new ValidationError("no_qualifying_deliveries_for_settlement");
      }

      const totalDeliveryFees = money(rows.reduce((sum: number, r: any) => sum + parseFloat(r.courier_fee_amount || 0), 0));
      const totalCashCollected = scope.netsCash ? money(rows.reduce((sum: number, r: any) => sum + parseFloat(r.cash_collected_amount || 0), 0)) : 0;

      const settlement: CourierSettlement = {
        id: randomUUID(),
        courierId: dto.courierId,
        status: CourierSettlementStatus.PENDING,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        totalDeliveryFees,
        totalCashCollected,
        netPayout: money(totalDeliveryFees - totalCashCollected),
        deliveryCount: rows.length,
        notes: dto.notes,
        createdAt: new Date(),
      };

      const created = await this.settlementRepo.create(settlement, connection);
      const marked = await this.deliveryRepo.markDeliveriesAsCourierSettled(
        rows.map((r: any) => r.id),
        created.id,
        connection,
      );
      if (marked !== rows.length) throw new ValidationError("deliveries_already_settled_retry");

      await this.db.commit(connection);
      return created;
    } catch (error) {
      await this.db.rollback(connection);
      throw error;
    }
  }

  async getAllCouriersPendingEarnings(userId: string, role: UserRole, courierType?: string): Promise<CourierPendingEarningsSummary[]> {
    const pool = this.db.getPool();

    let joinScope: string;
    let joinParams: any[] = [];
    let where = "";
    let whereParams: any[] = [];

    if (role === UserRole.DELIVERY_MANAGER) {
      const officeId = await this.resolveOfficeId(userId);
      joinScope = "AND d.delivery_office_id = ?";
      joinParams = [officeId];
      where = "WHERE c.delivery_office_id = ? AND c.courier_type = 'OFFICE'";
      whereParams = [officeId];
    } else {
      // Admin: freelancers are matched to freelance deliveries, office couriers to the rest
      joinScope = `AND ((c.courier_type = 'FREELANCE' AND d.fulfillment_type = 'FREELANCE')
                     OR (c.courier_type = 'OFFICE' AND (d.fulfillment_type IS NULL OR d.fulfillment_type = 'OFFICE')))`;
      if (courierType === "FREELANCE" || courierType === "OFFICE") {
        where = "WHERE c.courier_type = ?";
        whereParams = [courierType];
      }
    }

    const [rows]: any = await pool.execute(
      `SELECT
         c.id as courierId,
         c.full_name as courierName,
         c.courier_type as courierType,
         COUNT(d.id) as unsettledDeliveries,
         COALESCE(SUM(d.courier_fee_amount), 0) as totalDeliveryFees,
         COALESCE(SUM(d.cash_collected_amount), 0) as totalCashCollected,
         MIN(d.delivered_at) as oldestUnsettledDeliveryDate
       FROM couriers c
       LEFT JOIN deliveries d
         ON d.courier_id = c.id AND d.status = 'DELIVERED' AND d.courier_settlement_id IS NULL ${joinScope}
       ${where}
       GROUP BY c.id, c.full_name, c.courier_type
       HAVING COUNT(d.id) > 0
       ORDER BY totalDeliveryFees DESC`,
      [...joinParams, ...whereParams],
    );
    return rows.map((row: any) => {
      const totalDeliveryFees = money(row.totalDeliveryFees);
      const totalCashCollected = money(row.totalCashCollected);
      const netsCash = role !== UserRole.DELIVERY_MANAGER && row.courierType === "FREELANCE";
      return {
        courierId: row.courierId,
        courierName: row.courierName,
        courierType: row.courierType,
        unsettledDeliveries: parseInt(row.unsettledDeliveries) || 0,
        totalDeliveryFees,
        totalCashCollected,
        netPayout: netsCash ? money(totalDeliveryFees - totalCashCollected) : totalDeliveryFees,
        oldestUnsettledDeliveryDate: row.oldestUnsettledDeliveryDate ?? undefined,
      };
    });
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
      if (!courier || courier.courierType !== "OFFICE" || courier.deliveryOfficeId !== officeId) {
        throw new UnauthorizedError("settlement_not_owned_by_your_office");
      }
    }

    await this.settlementRepo.updateStatus(id, CourierSettlementStatus.PAID, new Date());
  }

  async getPlatformOverview(): Promise<DeliveryPlatformOverview> {
    return this.settlementRepo.getPlatformOverview();
  }
}
