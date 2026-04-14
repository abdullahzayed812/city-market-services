import { Request, Response, NextFunction } from "express";
import { CatalogService } from "../../application/services/catalog.service";
import { ApiResponse } from "@city-market/shared";

export class GlobalProductController {
    constructor(private catalogService: CatalogService) { }

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const search = req.query.search as string | undefined;
            const result = await this.catalogService.getAllGlobalProducts(page, limit, search);
            res.json(ApiResponse.success(result));
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = await this.catalogService.getGlobalProductById(req.params.id);
            res.json(ApiResponse.success(product));
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = await this.catalogService.createGlobalProduct(req.body);
            res.status(201).json(ApiResponse.success(product, "global_product_created"));
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.catalogService.updateGlobalProduct(req.params.id, req.body);
            res.json(ApiResponse.success(null, "global_product_updated"));
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.catalogService.deleteGlobalProduct(req.params.id);
            res.json(ApiResponse.success(null, "global_product_deleted"));
        } catch (error) {
            next(error);
        }
    };
}
