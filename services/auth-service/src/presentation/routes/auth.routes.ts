import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "@city-market/shared/node";

export const createAuthRoutes = (controller: AuthController): Router => {
  const router = Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/validate", controller.validate);
  router.post("/logout", authenticate, controller.logout);
  router.post("/logout-all", authenticate, controller.logoutAll);
  router.get("/sessions", authenticate, controller.sessions);
  router.get("/users", controller.getUsers);
  router.get("/users/:id", controller.getUserById);
  router.patch("/users/:id/status", controller.updateUserStatus);
  router.post("/oauth/token", controller.issueServiceToken); // New route for service tokens

  return router;
};
