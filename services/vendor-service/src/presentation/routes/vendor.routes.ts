import { Router } from "express";
import { VendorController } from "../controllers/vendor.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createVendorRoutes = (controller: VendorController): Router => {
  const router = Router();

  // Admin / services create stores for an existing VENDOR user (approved at once)
  router.post("/", authorize(UserRole.ADMIN), controller.create);
  // Merchant onboarding: apply, then correct / resubmit while pending or after a rejection
  router.post("/register", authorize(UserRole.VENDOR), controller.register);
  router.put("/me/registration", authorize(UserRole.VENDOR), controller.resubmit);
  router.get("/me", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.getMyVendor);
  router.get("/open", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.getOpen);
  router.post("/bulk", authorize(UserRole.VENDOR, UserRole.ADMIN, UserRole.CUSTOMER), controller.getByIds);
  router.get("/count", authorize(UserRole.ADMIN), controller.getCount);
  router.patch("/:id/approval", authorize(UserRole.ADMIN), controller.setApproval);
  router.get("/:id/approval-history", authorize(UserRole.ADMIN), controller.getApprovalHistory);
  router.get("/:id", authorize(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN), controller.getById);
  router.get("/", authorize(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN), controller.getAll);
  // Ownership and approval are checked in VendorService
  router.patch("/:id", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.update);
  router.patch("/:id/status", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.updateStatus);
  router.post("/:id/working-hours", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.setWorkingHours);
  router.get("/:id/working-hours", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.getWorkingHours);
  router.patch("/:id/image", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.updateImage);

  return router;
};
