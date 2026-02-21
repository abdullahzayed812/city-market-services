import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createRoutes } from "./routes";
import { rateLimit } from "./middlewares/rate-limit.middleware";
import { Logger, errorHandler } from "@city-market/shared/node";

export const createApp = () => {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: true, // Allow all origins in dev, or configure specifically
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  app.use(rateLimit(100, 60000)); // 100 requests per minute

  // Request logging
  app.use((req, res, next) => {
    Logger.info(`${req.method} ${req.path}`, { ip: req.ip });
    next();
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "api-gateway" });
  });

  // Routes
  app.use("/api/v1", createRoutes());

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
};
