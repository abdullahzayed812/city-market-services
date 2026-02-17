import { Router } from "express";
import { UserController } from "../controllers/user.controller";

export const createUserRoutes = (controller: UserController): Router => {
  const router = Router();

  router.post("/customers", controller.createCustomer);
  router.get("/customers/me", controller.getMyProfile);
  router.patch("/customers/me", controller.updateProfile);
  router.post("/customers/me/addresses", controller.addAddress);
  router.get("/customers/me/addresses", controller.getMyAddresses);
  router.delete("/addresses/:addressId", controller.deleteAddress);

  return router;
};
