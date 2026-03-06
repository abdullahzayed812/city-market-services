import { Router } from "express";
import { GlobalProductController } from "../controllers/global-product.controller";

export const createGlobalProductRoutes = (controller: GlobalProductController): Router => {
    const router = Router();

    router.get("/global-products", controller.getAll);
    router.get("/global-products/:id", controller.getById);
    router.post("/global-products", controller.create);
    router.patch("/global-products/:id", controller.update);
    router.delete("/global-products/:id", controller.delete);

    return router;
};
