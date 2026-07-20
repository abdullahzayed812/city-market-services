import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createAdminRoutes = (controller: AdminController): Router => {
  const router = Router();

  router.get("/dashboard", authorize(UserRole.ADMIN), controller.getDashboard);
  router.get("/orders", authorize(UserRole.ADMIN), controller.getAllOrders);
  router.get("/vendors", authorize(UserRole.ADMIN), controller.getAllVendors);

  router.post("/vendors/:vendorId/suspend", authorize(UserRole.ADMIN), controller.suspendVendor);
  router.get("/couriers", authorize(UserRole.ADMIN), controller.getAllCouriers);
  router.post("/couriers/:courierId/deactivate", authorize(UserRole.ADMIN), controller.deactivateCourier);
  router.get("/users", authorize(UserRole.ADMIN), controller.getAllUsers);
  router.get("/users/:id", authorize(UserRole.ADMIN), controller.getUserById);
  router.patch("/users/:id/status", authorize(UserRole.ADMIN), controller.updateUserStatus);
  router.get("/vendors/:id", authorize(UserRole.ADMIN), controller.getVendorById);
  router.patch("/vendors/:id", authorize(UserRole.ADMIN), controller.updateVendor);
  router.patch("/vendors/:id/status", authorize(UserRole.ADMIN), controller.updateVendorStatus);
  router.patch("/vendors/:id/image", authorize(UserRole.ADMIN), controller.updateVendorImage);
  router.get("/orders/:id", authorize(UserRole.ADMIN), controller.getOrderById);
  router.patch("/orders/:id/status", authorize(UserRole.ADMIN), controller.updateOrderStatus);
  router.get("/deliveries", authorize(UserRole.ADMIN), controller.getDeliveries);
  router.get("/couriers/available", authorize(UserRole.ADMIN), controller.getAvailableCouriers);
  // router.get("/vendors/:vendorId/financial-analytics", authorize(UserRole.ADMIN), controller.getFinancialAnalytics);
  // router.get("/revenue", authorize(UserRole.ADMIN), controller.getRevenue);
  // router.get("/payouts", authorize(UserRole.ADMIN), controller.getPayouts);

  // Creation Management
  router.post("/users/register", authorize(UserRole.ADMIN), controller.registerUser);
  router.post("/couriers/register", authorize(UserRole.ADMIN), controller.createCourier);
  router.post("/vendors/register", authorize(UserRole.ADMIN), controller.createVendor);

  router.get("/categories", authorize(UserRole.ADMIN), controller.getAllCategories);
  router.post("/categories", authorize(UserRole.ADMIN), controller.createCategory);
  router.patch("/categories/:id", authorize(UserRole.ADMIN), controller.updateCategory);
  router.delete("/categories/:id", authorize(UserRole.ADMIN), controller.deleteCategory);
  router.patch("/categories/:id/icon", authorize(UserRole.ADMIN), controller.updateCategoryIcon);

  // Product Management
  router.get("/products", authorize(UserRole.ADMIN), controller.getAllProducts);
  router.post("/products", authorize(UserRole.ADMIN), controller.createProduct);
  router.put("/products/:id", authorize(UserRole.ADMIN), controller.updateProduct);
  router.delete("/products/:id", authorize(UserRole.ADMIN), controller.deleteProduct);
  router.patch("/products/:id/image", authorize(UserRole.ADMIN), controller.updateProductImage);
  router.post("/vendors/:vendorId/products/bulk-add-global", authorize(UserRole.ADMIN), controller.bulkAddVendorProductsFromGlobal);

  // Global Product Management
  router.get("/global-products", authorize(UserRole.ADMIN), controller.getGlobalProducts);
  router.post("/global-products/bulk", authorize(UserRole.ADMIN), controller.bulkCreateGlobalProducts);
  router.post("/global-products", authorize(UserRole.ADMIN), controller.createGlobalProduct);
  router.patch("/global-products/:id", authorize(UserRole.ADMIN), controller.updateGlobalProduct);
  router.delete("/global-products/:id", authorize(UserRole.ADMIN), controller.deleteGlobalProduct);

  // Commission Tiers Management
  router.get("/commission-tiers", authorize(UserRole.ADMIN), controller.getAllCommissionTiers);
  router.post("/commission-tiers", authorize(UserRole.ADMIN), controller.createCommissionTier);
  router.patch("/commission-tiers/:id", authorize(UserRole.ADMIN), controller.updateCommissionTier);
  router.delete("/commission-tiers/:id", authorize(UserRole.ADMIN), controller.deleteCommissionTier);

  // Delivery Offices
  router.get("/delivery-offices", authorize(UserRole.ADMIN), controller.getAllDeliveryOffices);

  // Delivery Fee Tiers
  router.get("/delivery-fee-tiers", authorize(UserRole.ADMIN), controller.getAllDeliveryFeeTiers);
  router.post("/delivery-fee-tiers", authorize(UserRole.ADMIN), controller.createDeliveryFeeTier);
  router.patch("/delivery-fee-tiers/:id", authorize(UserRole.ADMIN), controller.updateDeliveryFeeTier);
  router.delete("/delivery-fee-tiers/:id", authorize(UserRole.ADMIN), controller.deleteDeliveryFeeTier);

  // Courier Settlements
  router.get("/delivery-settlements/courier/:courierId/pending", authorize(UserRole.ADMIN), controller.getCourierPendingEarnings);
  router.get("/delivery-settlements/courier", authorize(UserRole.ADMIN), controller.getCourierSettlements);
  router.post("/delivery-settlements/courier", authorize(UserRole.ADMIN), controller.createCourierSettlement);
  router.patch("/delivery-settlements/courier/:id/mark-paid", authorize(UserRole.ADMIN), controller.markCourierSettlementPaid);

  // Office Settlements
  router.get("/delivery-settlements/office/pending", authorize(UserRole.ADMIN), controller.getOfficePendingEarnings);
  router.get("/delivery-settlements/office", authorize(UserRole.ADMIN), controller.getOfficeSettlements);
  router.post("/delivery-settlements/office", authorize(UserRole.ADMIN), controller.createOfficeSettlement);
  router.patch("/delivery-settlements/office/:id/mark-paid", authorize(UserRole.ADMIN), controller.markOfficeSettlementPaid);

  // Settlement Management
  router.get("/settlements/vendor/:vendorId/pending", authorize(UserRole.ADMIN), controller.getVendorPendingEarnings);
  router.get("/settlements", authorize(UserRole.ADMIN), controller.getSettlements);
  router.post("/settlements", authorize(UserRole.ADMIN), controller.createSettlement);
  router.patch("/settlements/:id/mark-paid", authorize(UserRole.ADMIN), controller.markSettlementPaid);
  router.get("/settlements/overview", authorize(UserRole.ADMIN), controller.getPlatformFinancialOverview);

  return router;
};
