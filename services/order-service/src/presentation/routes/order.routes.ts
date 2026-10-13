import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { authorize } from "@city-market/shared/node";
import { UserRole } from "@city-market/shared";

export const createOrderRoutes = (controller: OrderController): Router => {
  const router = Router();

  // Customer Routes
  router.get("/delivery-fee", controller.getDeliveryFeePreview);
  router.post("/", controller.create);
  router.get("/customer-orders", controller.getMyOrders);
  router.get("/customer-orders/:id", controller.getCustomerOrderById);
  // Service-to-service (authorize() lets service tokens through): delivery-service list enrichment
  router.post("/customer-orders/batch", authorize(UserRole.ADMIN), controller.getCustomerOrdersBatch);
  router.get("/customer-orders/:id/proposals", controller.getOrderProposals);
  router.post("/customer-orders/:id/resolve-cancellation", controller.resolveVendorCancellation);
  // Status is driven by vendor / delivery events; setting it by hand (e.g. COMPLETED, which
  // commits stock) is for admins and services only. No customer app calls this.
  router.patch("/customer-orders/:id/status", authorize(UserRole.ADMIN), controller.updateCustomerOrderStatus);
  // Vendor Routes
  // Merchant order actions: approved merchants on their own store (checked in the controller), admins, services
  const merchant = authorize(UserRole.VENDOR, UserRole.ADMIN);
  router.get("/vendor/:vendorId", merchant, controller.getVendorOrders); // restored
  router.get("/vendor/:vendorId/financials", merchant, controller.getVendorFinancials);
  router.get("/vendor-orders/:id", merchant, controller.getVendorOrderById);
  router.post("/vendor-orders/:id/accept", merchant, controller.acceptVendorOrder);
  router.post("/vendor-orders/:id/propose", merchant, controller.proposeChanges);
  router.patch("/vendor-orders/:id/status", merchant, controller.updateVendorOrderStatus);

  // Proposal Routes (Customer; ownership checked in the controller)
  router.post("/proposals/:id/accept", controller.acceptProposal);
  router.post("/proposals/:id/reject", controller.rejectProposal);

  // Admin/Service Routes
  router.get("/stats", authorize(UserRole.ADMIN), controller.getStats);
  router.get("/", authorize(UserRole.ADMIN), controller.getAllOrders);

  return router;
};
