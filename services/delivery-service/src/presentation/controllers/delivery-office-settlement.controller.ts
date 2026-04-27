import { Request, Response, NextFunction } from "express";
import { DeliveryOfficeSettlementService } from "../../application/services/delivery-office-settlement.service";
import { ApiResponse } from "@city-market/shared";
import { UserRole } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class DeliveryOfficeSettlementController {
  constructor(private settlementService: DeliveryOfficeSettlementService) {}

  getPendingEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId ?? "service";
      const role = (req.user?.role ?? UserRole.ADMIN) as UserRole;
      const targetOfficeId = req.query.deliveryOfficeId as string | undefined;
      const summary = await this.settlementService.getPendingEarnings(userId, role, targetOfficeId);
      res.json(ApiResponse.success(summary));
    } catch (error) {
      next(error);
    }
  };

  createSettlement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId ?? "service";
      const role = (req.user?.role ?? UserRole.ADMIN) as UserRole;
      const settlement = await this.settlementService.createSettlement(req.body, userId, role);
      res.status(201).json(ApiResponse.success(settlement, "office_settlement_created"));
    } catch (error) {
      next(error);
    }
  };

  getSettlements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId ?? "service";
      const role = (req.user?.role ?? UserRole.ADMIN) as UserRole;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const targetOfficeId = req.query.deliveryOfficeId as string | undefined;
      const settlements = await this.settlementService.getSettlements(userId, role, limit, offset, targetOfficeId);
      res.json(ApiResponse.success(settlements));
    } catch (error) {
      next(error);
    }
  };

  markPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId ?? "service";
      const role = (req.user?.role ?? UserRole.ADMIN) as UserRole;
      const { id } = req.params;
      await this.settlementService.markSettlementAsPaid(id, userId, role);
      res.json(ApiResponse.success(null, "office_settlement_marked_paid"));
    } catch (error) {
      next(error);
    }
  };
}
