import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { UserRole } from "@city-market/shared";
import { authenticate, authorize } from "@city-market/shared/node";

export const createAdminRoutes = (controller: AdminController): Router => {
  const router = Router();

  router.get("/dashboard", authenticate, authorize(UserRole.ADMIN), controller.getDashboard);
  router.get("/orders", authenticate, authorize(UserRole.ADMIN), controller.getAllOrders);
  router.get("/vendors", authenticate, authorize(UserRole.ADMIN), controller.getAllVendors);
  router.patch(
    "/vendors/:vendorId/commission",
    authenticate,
    authorize(UserRole.ADMIN),
    controller.updateVendorCommission
  );
  router.post("/vendors/:vendorId/suspend", authenticate, authorize(UserRole.ADMIN), controller.suspendVendor);
  router.get("/couriers", authenticate, authorize(UserRole.ADMIN), controller.getAllCouriers);
  router.post("/couriers/:courierId/deactivate", authenticate, authorize(UserRole.ADMIN), controller.deactivateCourier);
  router.get("/users", authenticate, authorize(UserRole.ADMIN), controller.getAllUsers);
  router.get("/users/:id", authenticate, authorize(UserRole.ADMIN), controller.getUserById);
  router.patch("/users/:id/status", authenticate, authorize(UserRole.ADMIN), controller.updateUserStatus);
  router.get("/vendors/:id", authenticate, authorize(UserRole.ADMIN), controller.getVendorById);
  router.patch("/vendors/:id/status", authenticate, authorize(UserRole.ADMIN), controller.updateVendorStatus);
  router.get("/orders/:id", authenticate, authorize(UserRole.ADMIN), controller.getOrderById);
  router.patch("/orders/:id/status", authenticate, authorize(UserRole.ADMIN), controller.updateOrderStatus);
  router.get("/deliveries", authenticate, authorize(UserRole.ADMIN), controller.getDeliveries);
  router.get("/couriers/available", authenticate, authorize(UserRole.ADMIN), controller.getAvailableCouriers);
  router.get("/revenue", authenticate, authorize(UserRole.ADMIN), controller.getRevenue);
  router.get("/payouts", authenticate, authorize(UserRole.ADMIN), controller.getPayouts);

  return router;
};
