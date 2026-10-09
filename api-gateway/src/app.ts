import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createRoutes } from "./routes";
import { rateLimit } from "./middlewares/rate-limit.middleware";
import { config } from "./config/env";
import { Logger, errorHandler, correlation, idempotency } from "@city-market/shared/node";

export const createApp = () => {
  const app = express();

  // 1. Correlation ID (First middleware to catch all logs)
  app.use(correlation);

  // Security middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // 2. Idempotency (Prevent double requests from Frontend/Mobile)
  app.use(idempotency());

  // Rate limiting: 100 requests per minute per IP. RATE_LIMIT_MAX_REQUESTS /
  // RATE_LIMIT_WINDOW_MS exist so an isolated load-test instance (all traffic from
  // one generator IP) can be started without editing code; they are ignored in
  // production so a stray env var can never loosen the real limit.
  const isProduction = process.env.NODE_ENV === "production";
  app.use(
    isProduction
      ? rateLimit(100, 60000)
      : rateLimit(config.rateLimitMaxRequests, config.rateLimitWindowMs),
  );

  // Request logging using structured Logger
  app.use((req, res, next) => {
    Logger.info(
      `${req.method} ${req.path} `,
      // {
      //   ip: req.ip,
      //   userAgent: req.headers["user-agent"],
      //   query: req.query,
      // }
    );
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
      message: "route_not_found",
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
};
