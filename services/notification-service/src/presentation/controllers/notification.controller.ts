import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../../application/services/notification.service";
import { ApiResponse } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class NotificationController {
  constructor(private service: NotificationService) { }

  registerDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { token, platform, appType } = req.body;
      let language = req.headers["accept-language"] as string;
      if (language) {
        language = language.includes("en") ? "en" : "ar";
      } else {
        language = "ar"; // default fallback
      }
      await this.service.registerDevice(req.user!.userId, token, platform, appType, language);
      res.status(200).json(ApiResponse.success(null, "device_registered"));
    } catch (error) {
      next(error);
    }
  };

  getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getNotifications(req.user!.userId, page, limit);
      res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.service.markAsRead(req.user!.userId, req.params.id);
      res.json(ApiResponse.success(null, "marked_as_read"));
    } catch (error) {
      next(error);
    }
  };

  markAllRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.service.markAllRead(req.user!.userId);
      res.json(ApiResponse.success(null, "all_marked_as_read"));
    } catch (error) {
      next(error);
    }
  };
}
