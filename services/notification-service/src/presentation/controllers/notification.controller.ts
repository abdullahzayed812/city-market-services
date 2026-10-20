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
      await this.service.registerDevice(req.user!.userId, req.user!.role, token, platform, appType, language);
      res.status(200).json(ApiResponse.success(null, "device_registered"));
    } catch (error) {
      next(error);
    }
  };

  unregisterDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.service.unregisterDevice(req.user!.userId, req.body?.token);
      res.status(200).json(ApiResponse.success(null, "device_unregistered"));
    } catch (error) {
      next(error);
    }
  };

  getPreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(ApiResponse.success(await this.service.getPreferences(req.user!.userId)));
    } catch (error) {
      next(error);
    }
  };

  updatePreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(ApiResponse.success(await this.service.updatePreferences(req.user!.userId, req.body), "preferences_updated"));
    } catch (error) {
      next(error);
    }
  };

  getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
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
