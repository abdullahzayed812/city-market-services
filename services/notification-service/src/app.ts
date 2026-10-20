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

  app.delete(
    "/device-token",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.unregisterDevice,
  );

  // Push on/off for the signed-in user (in-app notifications are always kept)
  app.get(
    "/notifications/preferences",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.getPreferences,
  );

  app.patch(
    "/notifications/preferences",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.updatePreferences,
  );

  // Notifications
  app.get(
    "/notifications",
    authorize(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.COURIER, UserRole.ADMIN, UserRole.DELIVERY_MANAGER),
    controller.getNotifications,
  );

  // Admin badges: unread notifications grouped by the screen they open
  app.get("/notifications/unread-summary", authorize(UserRole.ADMIN), controller.getUnreadSummary);

  // Admin opened an item (vendor, courier, office, submission, order): its notifications are read
  app.patch("/notifications/read-target", authorize(UserRole.ADMIN), controller.markTargetRead);

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
