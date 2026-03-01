import { INotificationRepository } from "../../core/interfaces/notification.repository";
import { PushNotificationProvider } from "../../infrastructure/providers/push.provider";
import { Notification, NotificationPreference } from "../../core/entities/notification.entity";
import { randomUUID } from "crypto";
import { Logger } from "@city-market/shared/node";
import { AppType, PlatformType } from "@city-market/shared";

export class NotificationService {
  constructor(
    private repo: INotificationRepository,
    private pushProvider: PushNotificationProvider,
  ) {}

  async sendNotification(userId: string, type: string, title: string, message: string, metadata?: any) {
    // 1. Check Preferences
    let prefs = await this.repo.getPreferences(userId);
    if (!prefs) {
      // Default preferences if not found
      prefs = { userId, emailEnabled: true, pushEnabled: true, smsEnabled: false, updatedAt: new Date() };
      await this.repo.upsertPreferences(prefs);
    }

    // 2. Save Notification
    const notification: Notification = {
      id: randomUUID(),
      userId,
      type,
      title,
      message,
      isRead: false,
      metadata,
      createdAt: new Date(),
    };
    await this.repo.create(notification);

    // 3. Dispatch Push
    if (prefs.pushEnabled) {
      const tokens = await this.repo.getDeviceTokens(userId);
      if (tokens.length > 0) {
        await this.pushProvider.sendMulticast(
          tokens.map((t) => t.token),
          title,
          message,
          { notificationId: notification.id, ...metadata },
        );
      }
    }

    // 4. Dispatch Email (Placeholder)
    if (prefs.emailEnabled) {
      Logger.info(`[EmailProvider] Should send email to user ${userId}: ${title}`);
    }
  }

  async registerDevice(userId: string, token: string, platform: PlatformType, appType: AppType) {
    await this.repo.addDeviceToken({ userId, token, platform, appType, lastActive: new Date() });
  }

  async getNotifications(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const [items, total, unread] = await Promise.all([
      this.repo.findByUserId(userId, limit, offset),
      // Ideally countAll but simpler for now
      Promise.resolve(0),
      this.repo.countUnread(userId),
    ]);
    return { items, unread };
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.repo.markAsRead(notificationId);
  }

  async markAllRead(userId: string) {
    await this.repo.markAllAsRead(userId);
  }
}
