import { Router } from "express";
import { RatingController } from "../controllers/RatingController";
import { createRatingValidator } from "../validators/createRating.validator";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createRatingRoutes = (controller: RatingController): Router => {
    const router = Router();

    // Only CUSTOMER role can rate
    router.post("/", authorize(UserRole.CUSTOMER), createRatingValidator, controller.create);

    // Anyone authenticated can view vendor rating summary? 
    // Usually vendor rating is public, but requirements say "Only authenticated users" in security section.
    router.get("/vendors/:vendorId/rating", controller.getVendorRating);

    // Get list of reviews for a vendor
    router.get("/vendors/:vendorId", controller.getVendorRatings);

    return router;
};
