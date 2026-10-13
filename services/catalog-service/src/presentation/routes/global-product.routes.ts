import { Router } from "express";
import { GlobalProductController } from "../controllers/global-product.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createGlobalProductRoutes = (controller: GlobalProductController): Router => {
    const router = Router();

    router.get("/global-products", controller.getAll);
    // The shared catalog is managed by admins (admin-service calls with a service token)
    router.post("/global-products/bulk", authorize(UserRole.ADMIN), controller.bulkCreate);
    router.get("/global-products/:id", controller.getById);
    router.post("/global-products", authorize(UserRole.ADMIN), controller.create);
    router.patch("/global-products/:id", authorize(UserRole.ADMIN), controller.update);
    router.delete("/global-products/:id", authorize(UserRole.ADMIN), controller.delete);

    return router;
};
