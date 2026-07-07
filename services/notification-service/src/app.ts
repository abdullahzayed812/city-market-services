import express from "express";
import cors from "cors";
import { NotificationService } from "./application/services/notification.service";
import { NotificationController } from "./presentation/controllers/notification.controller";
import { errorHandler, authorize, authenticate, correlation } from "@city-market/shared/node";
import { UserRole } from "@city-market/shared";

export const createApp = (service: NotificationService) => {
  const app = express();
  
  app.use(correlation);
  const controller = new NotificationController(service);

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : true,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "notification-service" });
  });

  app.use(authenticate);

  // Device Token Registration (All Authenticated Users)
  app.post(
    "/device-token",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.registerDevice,
  );

  // Notifications
  app.get(
    "/notifications",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.getNotifications,
  );

  app.patch(
    "/notifications/:id/read",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.markAsRead,
  );

  app.patch(
    "/notifications/read-all",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.markAllRead,
  );

  app.use(errorHandler);

  return app;
};
