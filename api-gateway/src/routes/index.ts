import { Router } from "express";
import { config } from "../config/env";
import { setupProxy } from "../middlewares/proxy.middleware";

export const createRoutes = (): Router => {
  const router = Router();

  router.use("/auth", setupProxy("/auth", config.authServiceUrl));
  router.use("/users", setupProxy("/users", config.userServiceUrl));
  router.use("/admin", setupProxy("/admin", config.adminServiceUrl));
  router.use("/orders", setupProxy("/orders", config.orderServiceUrl));
  router.use("/catalog", setupProxy("/catalog", config.catalogServiceUrl));
  router.use("/vendors", setupProxy("/vendors", config.vendorServiceUrl));
  router.use("/delivery", setupProxy("/delivery", config.deliveryServiceUrl));
  router.use("/notification", setupProxy("", config.notificationsServiceUrl));
  router.use("/ratings", setupProxy("", config.ratingServiceUrl));

  return router;
};
