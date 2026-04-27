import { Router } from "express";
import { DeliveryFeeTierController } from "../controllers/delivery-fee-tier.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";

export const createDeliveryFeeTierRoutes = (controller: DeliveryFeeTierController): Router => {
  const router = Router();

  router.get("/", authorize(UserRole.ADMIN), controller.getAll);
  router.post("/", authorize(UserRole.ADMIN), controller.create);
  router.patch("/:id", authorize(UserRole.ADMIN), controller.update);
  router.delete("/:id", authorize(UserRole.ADMIN), controller.delete);

  return router;
};
