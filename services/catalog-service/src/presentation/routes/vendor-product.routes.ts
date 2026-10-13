import { Router } from "express";
import { VendorProductController } from "../controllers/vendor-product.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createVendorProductRoutes = (controller: VendorProductController): Router => {
  const router = Router();

  // Writes: approved merchants (own store only, checked in the controller), admins, services.
  // Merchants add existing catalog products to their store; they never create catalog products.
  const writers = authorize(UserRole.VENDOR, UserRole.ADMIN);
  router.post("/products", writers, controller.create);
  router.get("/products", controller.getAll);
  router.get("/products/search", controller.search);
  router.get("/products/vendor/:vendorId", controller.getByVendor);
  router.post(
    "/products/vendor/:vendorId/bulk-add-global",
    authorize(UserRole.VENDOR, UserRole.ADMIN),
    controller.bulkAddFromGlobal,
  );
  router.get("/products/category/:categoryId", controller.getByCategory);
  router.get("/products/:id", controller.getById);
  router.patch("/products/:id", writers, controller.update);
  router.patch("/products/:id/stock", writers, controller.updateStock);
  router.patch("/products/:id/price", writers, controller.updatePrice);
  // order-service (service token) releases reserved stock
  router.patch("/products/:id/release", authorize(UserRole.ADMIN), controller.releaseStock);
  // The image belongs to the shared catalog (global) product, so only admins change it
  router.patch("/products/:id/image", authorize(UserRole.ADMIN), controller.updateImage);
  router.delete("/products/:id", writers, controller.delete);

  return router;
};
