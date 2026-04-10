import { Router } from "express";
import { OrderController } from "../controllers/order.controller";

export const createOrderRoutes = (controller: OrderController): Router => {
  const router = Router();

  // Customer Routes
  router.get("/delivery-fee", controller.getDeliveryFeePreview);
  router.post("/", controller.create);
  router.get("/customer-orders", controller.getMyOrders);
  router.get("/customer-orders/:id", controller.getCustomerOrderById);
  router.get("/customer-orders/:id/proposals", controller.getOrderProposals);
  router.patch("/customer-orders/:id/status", controller.updateCustomerOrderStatus);

  // Vendor Routes
  router.get("/vendor/:vendorId", controller.getVendorOrders); // restored
  router.get("/vendor/:vendorId/financials", controller.getVendorFinancials);
  router.get("/vendor-orders/:id", controller.getVendorOrderById);
  router.post("/vendor-orders/:id/accept", controller.acceptVendorOrder);
  router.post("/vendor-orders/:id/propose", controller.proposeChanges);
  router.patch("/vendor-orders/:id/status", controller.updateVendorOrderStatus);

  // Proposal Routes (Customer)
  router.post("/proposals/:id/accept", controller.acceptProposal);
  router.post("/proposals/:id/reject", controller.rejectProposal);

  // Admin/Service Routes
  router.get("/", controller.getAllOrders);

  return router;
};
