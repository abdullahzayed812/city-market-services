import { Response, NextFunction } from "express";
import { RatingService } from "../../application/services/RatingService";
import { ApiResponse } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class RatingController {
    constructor(private ratingService: RatingService) { }

    create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const customerId = req.user?.userId;
            if (!customerId) throw new Error("unauthorized");

            const { orderId, vendorId, stars, comment } = req.body;
            const rating = await this.ratingService.createRating({ orderId, vendorId, stars, comment }, customerId);
            res.status(201).json(ApiResponse.success(rating, "rating_created"));
        } catch (error) {
            next(error);
        }
    };

    getVendorRating = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { vendorId } = req.params;
            const summary = await this.ratingService.getVendorRating(vendorId);
            res.json(ApiResponse.success(summary));
        } catch (error) {
            next(error);
        }
    };

    getVendorRatings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { vendorId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
            const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
            const ratings = await this.ratingService.getVendorRatingsList(vendorId, limit, offset, req.user?.userId);
            res.json(ApiResponse.success(ratings));
        } catch (error) {
            next(error);
        }
    };
}
