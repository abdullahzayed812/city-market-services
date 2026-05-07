import { Router } from "express";
import { VendorProductController } from "../controllers/vendor-product.controller";

export const createVendorProductRoutes = (controller: VendorProductController): Router => {
  const router = Router();

  router.post("/products", controller.create);
  router.get("/products", controller.getAll);
  router.get("/products/search", controller.search);
  router.get("/products/vendor/:vendorId", controller.getByVendor);
  router.get("/products/category/:categoryId", controller.getByCategory);
  router.get("/products/:id", controller.getById);
  router.patch("/products/:id", controller.update);
  router.patch("/products/:id/stock", controller.updateStock);
  router.patch("/products/:id/price", controller.updatePrice);
  router.patch("/products/:id/release", controller.releaseStock);
  router.patch("/products/:id/image", controller.updateImage);
  router.delete("/products/:id", controller.delete);

  return router;
};
