import { Request, Response, NextFunction } from "express";
import { CommissionTierService } from "../../application/services/commission-tier.service";

export class CommissionTierController {
    constructor(private tierService: CommissionTierService) { }

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tiers = await this.tierService.getAllTiers();
            res.json({ data: tiers });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tier = await this.tierService.createTier(req.body);
            res.status(201).json({ data: tier });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.tierService.updateTier(req.params.id, req.body);
            res.json({ message: "Tier updated successfully" });
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.tierService.deleteTier(req.params.id);
            res.json({ message: "Tier deleted successfully" });
        } catch (error) {
            next(error);
        }
    };
}
