import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createAdminRoutes = (controller: AdminController): Router => {
  const router = Router();

  // Category Management
  const multer = require("multer");
  const upload = multer({ storage: multer.memoryStorage() });

  router.get("/dashboard", authorize(UserRole.ADMIN), controller.getDashboard);
  router.get("/orders", authorize(UserRole.ADMIN), controller.getAllOrders);
  router.get("/vendors", authorize(UserRole.ADMIN), controller.getAllVendors);
  router.patch("/vendors/:vendorId/commission", authorize(UserRole.ADMIN), controller.updateVendorCommission);
  router.post("/vendors/:vendorId/suspend", authorize(UserRole.ADMIN), controller.suspendVendor);
  router.get("/couriers", authorize(UserRole.ADMIN), controller.getAllCouriers);
  router.post("/couriers/:courierId/deactivate", authorize(UserRole.ADMIN), controller.deactivateCourier);
  router.get("/users", authorize(UserRole.ADMIN), controller.getAllUsers);
  router.get("/users/:id", authorize(UserRole.ADMIN), controller.getUserById);
  router.patch("/users/:id/status", authorize(UserRole.ADMIN), controller.updateUserStatus);
  router.get("/vendors/:id", authorize(UserRole.ADMIN), controller.getVendorById);
  router.patch("/vendors/:id/status", authorize(UserRole.ADMIN), controller.updateVendorStatus);
  router.post("/vendors/:id/image", authorize(UserRole.ADMIN), upload.single("image"), controller.uploadVendorImage);
  router.get("/orders/:id", authorize(UserRole.ADMIN), controller.getOrderById);
  router.patch("/orders/:id/status", authorize(UserRole.ADMIN), controller.updateOrderStatus);
  router.get("/deliveries", authorize(UserRole.ADMIN), controller.getDeliveries);
  router.get("/couriers/available", authorize(UserRole.ADMIN), controller.getAvailableCouriers);
  router.get("/revenue", authorize(UserRole.ADMIN), controller.getRevenue);
  router.get("/payouts", authorize(UserRole.ADMIN), controller.getPayouts);

  router.get("/categories", authorize(UserRole.ADMIN), controller.getAllCategories);
  router.post("/categories", authorize(UserRole.ADMIN), controller.createCategory);
  router.patch("/categories/:id", authorize(UserRole.ADMIN), controller.updateCategory);
  router.delete("/categories/:id", authorize(UserRole.ADMIN), controller.deleteCategory);
  router.post("/categories/:id/icon", authorize(UserRole.ADMIN), upload.single("icon"), controller.uploadCategoryIcon);

  // Product Management
  router.get("/products", authorize(UserRole.ADMIN), controller.getAllProducts);
  router.post("/products", authorize(UserRole.ADMIN), controller.createProduct);
  router.put("/products/:id", authorize(UserRole.ADMIN), controller.updateProduct);
  router.delete("/products/:id", authorize(UserRole.ADMIN), controller.deleteProduct);
  router.post("/products/:id/image", authorize(UserRole.ADMIN), upload.single("image"), controller.uploadProductImage);

  // Global Product Management
  router.get("/global-products", authorize(UserRole.ADMIN), controller.getGlobalProducts);
  router.post("/global-products", authorize(UserRole.ADMIN), controller.createGlobalProduct);
  router.patch("/global-products/:id", authorize(UserRole.ADMIN), controller.updateGlobalProduct);
  router.delete("/global-products/:id", authorize(UserRole.ADMIN), controller.deleteGlobalProduct);

  return router;
}
