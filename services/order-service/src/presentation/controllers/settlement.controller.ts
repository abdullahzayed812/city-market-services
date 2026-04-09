import { Request, Response, NextFunction } from "express";
import { SettlementService } from "../../application/services/settlement.service";
import { ApiResponse } from "@city-market/shared";

export class SettlementController {
    constructor(private settlementService: SettlementService) { }

    async getVendorPendingEarnings(req: Request, res: Response, next: NextFunction) {
        try {
            const { vendorId } = req.params;
            const summary = await this.settlementService.getVendorPendingEarnings(vendorId);
            res.json({ success: true, data: summary } as ApiResponse<any>);
        } catch (error) {
            next(error);
        }
    }

    async createSettlement(req: Request, res: Response, next: NextFunction) {
        try {
            const settlement = await this.settlementService.createSettlement(req.body);
            res.status(201).json({ success: true, data: settlement } as ApiResponse<any>);
        } catch (error) {
            next(error);
        }
    }

    async getSettlements(req: Request, res: Response, next: NextFunction) {
        try {
            const { vendorId } = req.query;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            const settlements = await this.settlementService.getSettlements(vendorId as string, limit, offset);
            res.json({ success: true, data: settlements } as ApiResponse<any>);
        } catch (error) {
            next(error);
        }
    }

    async markPaid(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            await this.settlementService.markSettlementAsPaid(id);
            res.json({ success: true, data: null } as ApiResponse<any>);
        } catch (error) {
            next(error);
        }
    }

    async getPlatformOverview(req: Request, res: Response, next: NextFunction) {
        try {
            const overview = await this.settlementService.getPlatformFinancialOverview();
            res.json({ success: true, data: overview } as ApiResponse<any>);
        } catch (error) {
            next(error);
        }
    }
}
