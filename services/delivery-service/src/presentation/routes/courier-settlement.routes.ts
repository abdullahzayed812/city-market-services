import { Router } from "express";
import { CourierSettlementController } from "../controllers/courier-settlement.controller";
import { authorize } from "@city-market/shared/node";
import { UserRole } from "@city-market/shared";

export const createCourierSettlementRoutes = (controller: CourierSettlementController): Router => {
  const router = Router();

  // Courier views their own pending earnings
  router.get(
    "/courier/:courierId/pending",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.getCourierPendingEarnings,
  );

  // List settlements (filter by courierId query param, or all for admin)
  router.get(
    "/",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.getSettlements,
  );

  // Admin creates a settlement for a courier
  router.post(
    "/",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.createSettlement,
  );

  // Admin marks a settlement as paid
  router.patch(
    "/:id/mark-paid",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.markPaid,
  );

  // All couriers pending earnings (for delivery manager to batch-settle)
  router.get(
    "/all-pending",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.getAllCouriersPendingEarnings,
  );

  // Platform financial overview (admin only)
  router.get(
    "/overview",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.getPlatformOverview,
  );

  return router;
};
