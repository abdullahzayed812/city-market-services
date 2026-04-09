import { Router } from "express";
import { SettlementController } from "../controllers/settlement.controller";
import { authorize } from "@city-market/shared/node";
import { UserRole } from "@city-market/shared";

export const createSettlementRoutes = (controller: SettlementController) => {
    const router = Router();

    router.get(
        "/vendor/:vendorId/pending",
        authorize(UserRole.ADMIN, UserRole.VENDOR),
        (req, res, next) => controller.getVendorPendingEarnings(req, res, next)
    );

    router.get(
        "/",
        authorize(UserRole.ADMIN, UserRole.VENDOR),
        (req, res, next) => controller.getSettlements(req, res, next)
    );

    router.post(
        "/",
        authorize(UserRole.ADMIN),
        (req, res, next) => controller.createSettlement(req, res, next)
    );

    router.patch(
        "/:id/mark-paid",
        authorize(UserRole.ADMIN),
        (req, res, next) => controller.markPaid(req, res, next)
    );

    router.get(
        "/overview",
        authorize(UserRole.ADMIN),
        (req, res, next) => controller.getPlatformOverview(req, res, next)
    );

    return router;
};
