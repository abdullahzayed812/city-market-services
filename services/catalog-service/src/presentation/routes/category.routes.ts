import { Router } from "express";
import { CategoryController } from "../controllers/category.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";
import { uploadCategoryIcon } from "../middlewares/upload.middleware";

export const createCategoryRoutes = (controller: CategoryController): Router => {
  const router = Router();

  // Create/Manage (Admin & Vendor)
  router.post("/categories", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.create);
  router.patch("/categories/:id", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.update);
  router.delete("/categories/:id", authorize(UserRole.VENDOR, UserRole.ADMIN), controller.delete);
  router.post(
    "/categories/:id/icon",
    authorize(UserRole.VENDOR, UserRole.ADMIN),
    uploadCategoryIcon.single("icon"),
    controller.uploadIcon,
  );

  // Queries
  router.get("/categories/global", controller.getGlobal);
  router.get("/categories/vendor/:vendorId", controller.getVendor);
  router.get("/categories", controller.getAll);
  router.get("/categories/:id", controller.getById);

  return router;
};
