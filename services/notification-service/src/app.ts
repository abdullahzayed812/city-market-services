import express from "express";
import cors from "cors";
import { NotificationService } from "./application/services/notification.service";
import { eventBus } from "@city-market/shared";
import { errorHandler } from "@city-market/shared/node";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Initialize notification service (subscribes to events)
  new NotificationService(eventBus);

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "notification-service" });
  });

  app.use(errorHandler);

  return app;
};
