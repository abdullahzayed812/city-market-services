import express from "express";
import { createAuthRoutes } from "./presentation/routes/auth.routes";
import { AuthController } from "./presentation/controllers/auth.controller";
import { AuthService } from "./application/services/auth.service";
import { UserRepository } from "./infrastructure/repositories/user.repository";
import { RefreshTokenRepository } from "./infrastructure/repositories/refresh-token.repository";
import { errorHandler, Database, Logger } from "@city-market/shared/node";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  app.use(express.json());

  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  // Repositories
  const userRepo = new UserRepository(db);
  const refreshTokenRepo = new RefreshTokenRepository(db);

  // Services
  const authService = new AuthService(userRepo, refreshTokenRepo);

  // Controllers
  const authController = new AuthController(authService);

  // Request logging
  app.use((req, res, next) => {
    Logger.info(`${req.method} ${req.path}`, { ip: req.ip });
    next();
  });

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
