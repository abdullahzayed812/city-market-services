import { Response, NextFunction } from "express";
import { CourierSettlementService } from "../../application/services/courier-settlement.service";
import { ApiResponse, UserRole } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class CourierSettlementController {
  constructor(private settlementService: CourierSettlementService) {}

  getCourierPendingEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { courierId } = req.params;
      const summary = await this.settlementService.getCourierPendingEarnings(courierId);
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
      res.status(201).json(ApiResponse.success(settlement, "settlement_created"));
    } catch (error) {
      next(error);
    }
  };

  getSettlements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId ?? "service";
      const role = (req.user?.role ?? UserRole.ADMIN) as UserRole;
      const { courierId } = req.query;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const settlements = await this.settlementService.getSettlements(
        userId,
        role,
        courierId as string | undefined,
        limit,
        offset,
      );
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
      res.json(ApiResponse.success(null, "settlement_marked_paid"));
    } catch (error) {
      next(error);
    }
  };

  getAllCouriersPendingEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId ?? "service";
      const role = (req.user?.role ?? UserRole.ADMIN) as UserRole;
      const summaries = await this.settlementService.getAllCouriersPendingEarnings(userId, role);
      res.json(ApiResponse.success(summaries));
    } catch (error) {
      next(error);
    }
  };

  getPlatformOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const overview = await this.settlementService.getPlatformOverview();
      res.json(ApiResponse.success(overview));
    } catch (error) {
      next(error);
    }
  };
}
