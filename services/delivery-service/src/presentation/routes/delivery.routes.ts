import { Router } from "express";
import { DeliveryController } from "../controllers/delivery.controller";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { UserRole } from "@city-market/shared";
import { ApiResponse, NotFoundError } from "@city-market/shared";
import { authorize, AuthenticatedRequest } from "@city-market/shared/node";

export const createDeliveryRoutes = (controller: DeliveryController, deliveryOfficeRepo: IDeliveryOfficeRepository): Router => {
  const router = Router();

  // Courier routes
  router.post("/couriers", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.registerCourier);
  router.post("/couriers/freelance/register", authorize(UserRole.COURIER), controller.registerFreelancer);
  // Manager adds a new courier (login + profile) to their office; waits for admin review
  router.post("/couriers/office/register", authorize(UserRole.DELIVERY_MANAGER), controller.createOfficeCourier);
  router.get("/couriers", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getAllCouriers);
  router.get("/couriers/count", authorize(UserRole.ADMIN), controller.getCouriersCount);
  router.get("/couriers/me", authorize(UserRole.COURIER), controller.getMyCourier);
  router.patch("/couriers/me/availability", authorize(UserRole.COURIER), controller.updateMyAvailability);
  router.patch("/couriers/me/location", authorize(UserRole.COURIER), controller.updateMyLocation);
  // S4: couriers must not list other couriers (phones)
  router.get("/couriers/available", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getAvailableCouriers);
  // Review a courier: profile, identity documents, office, delivery counts
  router.get("/couriers/by-user/:userId/details", authorize(UserRole.ADMIN), controller.getCourierDetailsByUserId);
  router.get("/couriers/:id/details", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getCourierDetails);
  router.patch("/couriers/:id", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER), controller.updateCourier);
  router.patch("/couriers/:id/availability", authorize(UserRole.COURIER), controller.updateAvailability);
  router.patch("/couriers/:id/deactivate", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.deactivateCourier);
  router.patch("/couriers/:id/approval", authorize(UserRole.ADMIN), controller.setCourierApproval);

  // Delivery routes
  router.post("/deliveries", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.createDelivery);
  router.get("/deliveries/pending", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getPendingDeliveries);
  router.get("/deliveries/freelance/available", authorize(UserRole.COURIER), controller.getFreelancePool);
  router.get("/deliveries/my-deliveries", authorize(UserRole.COURIER), controller.getMyCourierDeliveries);
  // Customer: the courier(s) bringing their order (Phase 4); ownership checked in the service
  router.get("/deliveries/by-order/:customerOrderId/couriers", authorize(UserRole.CUSTOMER), controller.getOrderCouriers);
  router.get("/deliveries/:id", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER), controller.getDeliveryById);
  router.patch("/deliveries/:id/accept", authorize(UserRole.DELIVERY_MANAGER), controller.acceptDelivery);
  router.patch("/deliveries/:id/claim", authorize(UserRole.COURIER), controller.claimDelivery);
  router.post("/deliveries/:id/assign", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.assignCourier);
  router.patch("/deliveries/:id/status", authorize(UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.updateDeliveryStatus);
  router.patch("/deliveries/:id/cancel-by-courier", authorize(UserRole.COURIER), controller.cancelDeliveryByCourier);
  router.patch("/deliveries/:id/release", authorize(UserRole.COURIER), controller.releaseDeliveryByCourier);
  // Customer rates the courier (and their office) after delivery
  router.post("/deliveries/:id/rating", authorize(UserRole.CUSTOMER), controller.rateDelivery);
  router.patch("/deliveries/:id/cancel-by-manager", authorize(UserRole.DELIVERY_MANAGER), controller.cancelDeliveryByManager);
  router.get("/deliveries", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER), controller.getAllDeliveries);
  router.get("/deliveries-analytics", authorize(UserRole.ADMIN), controller.getFinancialAnalytics);
  // Customer ratings of deliveries: courier = own, manager = own office, admin = all
  router.get("/delivery-ratings", authorize(UserRole.ADMIN, UserRole.DELIVERY_MANAGER, UserRole.COURIER), controller.getDeliveryRatings);

  // Offices: admin list (filter ?approvalStatus=), self-registration, review
  router.get("/delivery-offices", authorize(UserRole.ADMIN), controller.listOffices);
  router.post("/delivery-offices", authorize(UserRole.ADMIN), controller.createOfficeByAdmin);
  router.post("/delivery-offices/register", authorize(UserRole.DELIVERY_MANAGER), controller.registerOffice);
  router.get("/delivery-offices/:id/details", authorize(UserRole.ADMIN), controller.getOfficeDetails);
  router.patch("/delivery-offices/:id/approval", authorize(UserRole.ADMIN), controller.setOfficeApproval);

  // Used by the websocket gateway to put a manager in their office's room (S6)
  router.get("/delivery-offices/me", authorize(UserRole.DELIVERY_MANAGER), async (req: AuthenticatedRequest, res, next) => {
    try {
      const office = await deliveryOfficeRepo.findByUserId(req.user!.userId);
      if (!office) throw new NotFoundError("delivery_office_not_found");
      res.json(ApiResponse.success(office));
    } catch (error) {
      next(error);
    }
  });

  return router;
};
