import { Request, Response, NextFunction } from "express";
import { CatalogService } from "../../application/services/catalog.service";
import { ApiResponse, ValidationError, MeasurementType, WeightUnit } from "@city-market/shared";

export class GlobalProductController {
    constructor(private catalogService: CatalogService) { }

    bulkCreate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { items, globalCategoryId, measurementType, weightUnit } = req.body as {
                items?: Array<{ name?: string; description?: string; imageUrl?: string }>;
                globalCategoryId?: string;
                measurementType?: MeasurementType;
                weightUnit?: WeightUnit;
            };

            if (!Array.isArray(items) || items.length === 0) {
                throw new ValidationError("items_required");
            }
            if (!globalCategoryId) {
                throw new ValidationError("global_category_id_required");
            }
            if (!measurementType || !Object.values(MeasurementType).includes(measurementType)) {
                throw new ValidationError("invalid_measurement_type");
            }

            const invalidRow = items.findIndex((item) => !item.name || !item.name.trim());
            if (invalidRow !== -1) {
                throw new ValidationError(`item_${invalidRow}_missing_name`);
            }

            const result = await this.catalogService.bulkCreateGlobalProducts(
                items as Array<{ name: string; description?: string; imageUrl?: string }>,
                globalCategoryId,
                measurementType,
                weightUnit,
            );
            res.status(201).json(ApiResponse.success(result, "global_products_bulk_imported"));
        } catch (error) {
            next(error);
        }
    };

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
