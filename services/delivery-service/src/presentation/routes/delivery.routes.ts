import { Router } from "express";
import { DeliveryController } from "../controllers/delivery.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createDeliveryRoutes = (controller: DeliveryController): Router => {
  const router = Router();

  // Courier routes
  router.post("/couriers", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.registerCourier);
  router.get("/couriers", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getAllCouriers);
  router.get("/couriers/me", authorize(UserRole.COURIER), controller.getMyCourier);
  router.get(
    "/couriers/available",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.getAvailableCouriers
  );
  router.patch(
    "/couriers/:id",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.updateCourier
  );
  router.patch("/couriers/:id/availability", authorize(UserRole.COURIER), controller.updateAvailability);

  // Delivery routes
  router.post("/deliveries", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.createDelivery);
  router.get(
    "/deliveries/pending",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.getPendingDeliveries
  );
  router.get("/deliveries/my-deliveries", authorize(UserRole.COURIER), controller.getMyCourierDeliveries);
  router.get(
    "/deliveries/:id",
    authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER),
    controller.getDeliveryById
  );
  router.post("/deliveries/:id/assign", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.assignCourier);
  router.patch(
    "/deliveries/:id/status",
    authorize(UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.updateDeliveryStatus
  );
  router.get("/deliveries", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getAllDeliveries);

  return router;
};
