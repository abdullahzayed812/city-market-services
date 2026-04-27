import { Response, NextFunction } from "express";
import { DeliveryFeeTierService } from "../../application/services/delivery-fee-tier.service";
import { ApiResponse } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class DeliveryFeeTierController {
  constructor(private tierService: DeliveryFeeTierService) {}

  getAll = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tiers = await this.tierService.getAll();
      res.json(ApiResponse.success(tiers));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tier = await this.tierService.create(req.body);
      res.status(201).json(ApiResponse.success(tier, "delivery_fee_tier_created"));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.tierService.update(req.params.id, req.body);
      res.json(ApiResponse.success(null, "delivery_fee_tier_updated"));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.tierService.delete(req.params.id);
      res.json(ApiResponse.success(null, "delivery_fee_tier_deleted"));
    } catch (error) {
      next(error);
    }
  };
}
