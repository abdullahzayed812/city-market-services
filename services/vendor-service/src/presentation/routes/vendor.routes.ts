import { Router } from "express";
import { VendorController } from "../controllers/vendor.controller";
import { UserRole } from "@city-market/shared";
import { authenticate, authorize } from "@city-market/shared/node";
import { uploadVendorImage } from "../middlewares/upload.middleware";

export const createVendorRoutes = (controller: VendorController): Router => {
  const router = Router();

  router.post("/", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.create);
  router.get("/me", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.getMyVendor);
  router.get("/open", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.getOpen);
  router.get("/:id", authenticate, authorize(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN), controller.getById);
  router.get("/", authenticate, authorize(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN), controller.getAll);
  router.patch("/:id", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.update);
  router.patch("/:id/status", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.updateStatus);
  router.post(
    "/:id/working-hours",
    authenticate,
    authorize(UserRole.VENDOR, UserRole.ADMIN),
    controller.setWorkingHours
  );
  router.get(
    "/:id/working-hours",
    authenticate,
    authorize(UserRole.VENDOR, UserRole.ADMIN),
    controller.getWorkingHours
  );
  router.post(
    "/:id/image",
    authenticate,
    authorize(UserRole.VENDOR, UserRole.ADMIN),
    uploadVendorImage.single("image"),
    controller.uploadImage
  );

  return router;
};
