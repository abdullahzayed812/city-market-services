import { Router } from "express";
import { DeliveryOfficeSettlementController } from "../controllers/delivery-office-settlement.controller";
import { authorize } from "@city-market/shared/node";
import { UserRole } from "@city-market/shared";

export const createDeliveryOfficeSettlementRoutes = (controller: DeliveryOfficeSettlementController): Router => {
  const router = Router();

  router.get(
    "/pending",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.getPendingEarnings,
  );

  router.get(
    "/",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.getSettlements,
  );

  router.post(
    "/",
    authorize(UserRole.ADMIN),
    controller.createSettlement,
  );

  router.patch(
    "/:id/mark-paid",
    authorize(UserRole.ADMIN),
    controller.markPaid,
  );

  return router;
};
