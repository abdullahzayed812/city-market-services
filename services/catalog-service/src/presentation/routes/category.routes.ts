import { Router } from "express";
import { CategoryController } from "../controllers/category.controller";
import { UserRole } from "@city-market/shared";
import { authenticate, authorize } from "@city-market/shared/node";

export const createCategoryRoutes = (controller: CategoryController): Router => {
  const router = Router();

  router.post("/categories", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.create);
  router.get(
    "/categories",
    authenticate,
    authorize(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN),
    controller.getAll
  );
  router.get(
    "/categories/:id",
    authenticate,
    authorize(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN),
    controller.getById
  );
  router.patch("/categories/:id", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.update);
  router.delete("/categories/:id", authenticate, authorize(UserRole.VENDOR, UserRole.ADMIN), controller.delete);

  return router;
};
