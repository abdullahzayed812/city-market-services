import { Router } from "express";
import { DeliveryController } from "../controllers/delivery.controller";
import { UserRole } from "@city-market/shared";
import { authenticate, authorize } from "@city-market/shared/node";

export const createDeliveryRoutes = (controller: DeliveryController): Router => {
  const router = Router();

  // Courier routes
  router.post("/couriers", authenticate, authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.registerCourier);
  router.get("/couriers", authenticate, authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getAllCouriers);
  router.get("/couriers/me", authenticate, authorize(UserRole.COURIER), controller.getMyCourier);
  router.get(
    "/couriers/available",
    authenticate,
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.getAvailableCouriers
  );
  router.patch("/couriers/:id", authenticate, authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER), controller.updateCourier);
  router.patch(
    "/couriers/:id/availability",
    authenticate,
    authorize(UserRole.COURIER),
    controller.updateAvailability
  );

  // Delivery routes
  router.post("/deliveries", authenticate, authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.createDelivery);
  router.get(
    "/deliveries/pending",
    authenticate,
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.getPendingDeliveries
  );
  router.get(
    "/deliveries/my",
    authenticate,
    authorize(UserRole.COURIER),
    controller.getMyCourierDeliveries
  );
  router.get("/deliveries/:id", authenticate, authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER), controller.getDeliveryById);
  router.post(
    "/deliveries/:id/assign",
    authenticate,
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.assignCourier
  );
  router.patch(
    "/deliveries/:id/status",
    authenticate,
    authorize(UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.updateDeliveryStatus
  );
  router.get("/deliveries", authenticate, authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getAllDeliveries);

  return router;
};
