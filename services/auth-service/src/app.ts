import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createAuthRoutes } from "./presentation/routes/auth.routes";
import { AuthController } from "./presentation/controllers/auth.controller";
import { AuthService } from "./application/services/auth.service";
import { UserRepository } from "./infrastructure/repositories/user.repository";
import { SessionRepository } from "./infrastructure/repositories/session.repository";
import { errorHandler, Database, Logger } from "@city-market/shared/node";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  // auth-service sits behind api-gateway/nginx; trust the first proxy hop so
  // req.ip reflects the real client IP (recorded on each session row).
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : true,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // Add this line for form-urlencoded bodies
  app.use(cookieParser());

  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  // Repositories
  const userRepo = new UserRepository(db);
  const sessionRepo = new SessionRepository(db);

  // Services
  const authService = new AuthService(userRepo, sessionRepo);

  // Controllers
  const authController = new AuthController(authService);

  // Routes
  app.use("/", createAuthRoutes(authController));

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "auth-service" });
  });

  // Error handler
  app.use(errorHandler);

  return app;
};
