import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { authenticate } from "@city-market/shared/node";

export const createOrderRoutes = (controller: OrderController): Router => {
  const router = Router();

  // Customer Routes
  router.post("/", authenticate, controller.create);
  router.get("/customer-orders", authenticate, controller.getMyOrders);
  router.get("/customer-orders/:id", authenticate, controller.getById);
  router.patch("/customer-orders/:id/status", authenticate, controller.updateCustomerOrderStatus);

  // Vendor Routes
  router.get("/vendor/:vendorId", authenticate, controller.getVendorOrders); // restored
  router.get("/vendor-orders/:id", authenticate, controller.getVendorOrderById);
  router.post("/vendor-orders/:id/accept", authenticate, controller.acceptVendorOrder);
  router.post("/vendor-orders/:id/propose", authenticate, controller.proposeChanges);
  router.patch("/vendor-orders/:id/status", authenticate, controller.updateVendorOrderStatus);

  // Proposal Routes (Customer)
  router.post("/proposals/:id/accept", authenticate, controller.acceptProposal);
  router.post("/proposals/:id/reject", authenticate, controller.rejectProposal);

  // Admin/Service Routes
  router.get("/", authenticate, controller.getAllOrders);

  return router;
};
