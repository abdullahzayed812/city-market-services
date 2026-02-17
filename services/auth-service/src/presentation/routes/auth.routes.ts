import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

export const createAuthRoutes = (controller: AuthController): Router => {
  const router = Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/validate", controller.validate);
  router.post("/logout", controller.logout);
  router.get("/users", controller.getUsers);
  router.get("/users/:id", controller.getUserById);
  router.patch("/users/:id/status", controller.updateUserStatus);
  router.post("/oauth/token", controller.issueServiceToken); // New route for service tokens

  return router;
};
