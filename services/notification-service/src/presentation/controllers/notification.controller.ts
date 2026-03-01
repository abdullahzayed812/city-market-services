import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../../application/services/notification.service";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class NotificationController {
  constructor(private service: NotificationService) {}

  registerDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { token, platform, appType } = req.body;
      await this.service.registerDevice(req.user!.userId, token, platform, appType);
      res.status(200).json({ message: "Device registered" });
    } catch (error) {
      next(error);
    }
  };

  getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getNotifications(req.user!.userId, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.service.markAsRead(req.user!.userId, req.params.id);
      res.json({ message: "Marked as read" });
    } catch (error) {
      next(error);
    }
  };

  markAllRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.service.markAllRead(req.user!.userId);
      res.json({ message: "All marked as read" });
    } catch (error) {
      next(error);
    }
  };
}
