import express from "express";
import cors from "cors";
import { config } from "./config/env";
import { Database, rabbitMQBus, errorHandler, authenticate } from "@city-market/shared/node";
import { RatingRepository } from "./infrastructure/database/repositories/RatingRepository";
import { VendorRatingSummaryRepository } from "./infrastructure/database/repositories/VendorRatingSummaryRepository";
import { OrderHttpClient } from "./infrastructure/clients/OrderHttpClient";
import { UserHttpClient } from "./infrastructure/clients/UserHttpClient";
import { VendorHttpClient } from "./infrastructure/clients/VendorHttpClient";
import { RatingPublisher } from "./infrastructure/messaging/RatingPublisher";
import { RatingService } from "./application/services/RatingService";
import { RatingController } from "./presentation/controllers/RatingController";
import { createRatingRoutes } from "./presentation/routes/rating.routes";

export const createApp = async () => {
  const app = express();

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : true,
      credentials: true,
    }),
  );
  app.use(express.json());

  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  const ratingRepo = new RatingRepository(db);
  const summaryRepo = new VendorRatingSummaryRepository(db);
  const orderClient = new OrderHttpClient(config.orderServiceUrl);
  const userClient = new UserHttpClient(config.userServiceUrl);
  const vendorClient = new VendorHttpClient(config.vendorServiceUrl);
  const publisher = new RatingPublisher(rabbitMQBus);

  const ratingService = new RatingService(ratingRepo, summaryRepo, orderClient, userClient, vendorClient, publisher, db);

  const ratingController = new RatingController(ratingService);

  app.use(authenticate);

  app.use("/", createRatingRoutes(ratingController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "rating-service" });
  });

  app.use(errorHandler);

  return app;
};
