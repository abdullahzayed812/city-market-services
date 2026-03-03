import { INotificationRepository } from "../../core/interfaces/notification.repository";
import { PushNotificationProvider } from "../../infrastructure/providers/push.provider";
import { Notification, NotificationPreference } from "../../core/entities/notification.entity";
import { randomUUID } from "crypto";
import { Logger } from "@city-market/shared/node";
import { AppType, PlatformType, translate } from "@city-market/shared";

export class NotificationService {
  constructor(
    private repo: INotificationRepository,
    private pushProvider: PushNotificationProvider,
  ) { }

  async sendNotification(userId: string, type: string, titleKey: string, messageKey: string, metadata?: Record<string, any>) {
    // 1. Check Preferences
    let prefs = await this.repo.getPreferences(userId);
    if (!prefs) {
      // Default preferences if not found
      prefs = { userId, emailEnabled: true, pushEnabled: true, smsEnabled: false, updatedAt: new Date() };
      await this.repo.upsertPreferences(prefs);
    }

    // Default translation for saving to DB (in English or fallback)
    const dbTitle = translate(titleKey, 'en', metadata);
    const dbMessage = translate(messageKey, 'en', metadata);

    // 2. Save Notification
    const notification: Notification = {
      id: randomUUID(),
      userId,
      type,
      title: dbTitle,
      message: dbMessage,
      isRead: false,
      metadata,
      createdAt: new Date(),
    };
    await this.repo.create(notification);

    // 3. Dispatch Push
    if (prefs.pushEnabled) {
      const tokens = await this.repo.getDeviceTokens(userId);
      if (tokens.length > 0) {

        // Group tokens by language
        const languageGroups = tokens.reduce((acc, token) => {
          const lang = token.language || 'ar';
          if (!acc[lang]) acc[lang] = [];
          acc[lang].push(token.token);
          return acc;
        }, {} as Record<string, string[]>);

        // Send to each language group
        for (const [lang, groupedTokens] of Object.entries(languageGroups)) {
          const translatedTitle = translate(titleKey, lang, metadata);
          const translatedMessage = translate(messageKey, lang, metadata);

          const staleTokens = await this.pushProvider.sendMulticast(
            groupedTokens,
            translatedTitle,
            translatedMessage,
            { notificationId: notification.id, ...metadata },
          );

          if (staleTokens && staleTokens.length > 0) {
            Logger.info(`[NotificationService] Removing ${staleTokens.length} stale device tokens for user ${userId}`);
            for (const token of staleTokens) {
              await this.repo.removeDeviceToken(token);
            }
          }
        }
      }
    }

    // 4. Dispatch Email (Placeholder)
    if (prefs.emailEnabled) {
      Logger.info(`[EmailProvider] Should send email to user ${userId}: ${dbTitle}`);
    }
  }

  async sendMulticastNotification(appType: AppType, type: string, titleKey: string, messageKey: string, metadata?: Record<string, any>) {
    const tokens = await this.repo.getTokensByAppType(appType);
    if (tokens.length === 0) return;

    // Group by language
    const languageGroups = tokens.reduce((acc, token) => {
      const lang = token.language || 'ar';
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(token.token);
      return acc;
    }, {} as Record<string, string[]>);

    for (const [lang, groupedTokens] of Object.entries(languageGroups)) {
      const translatedTitle = translate(titleKey, lang, metadata);
      const translatedMessage = translate(messageKey, lang, metadata);

      const staleTokens = await this.pushProvider.sendMulticast(
        groupedTokens,
        translatedTitle,
        translatedMessage,
        { ...metadata, type },
      );

      if (staleTokens && staleTokens.length > 0) {
        Logger.info(`[NotificationService] Removing ${staleTokens.length} stale device tokens for AppType ${appType}`);
        for (const token of staleTokens) {
          await this.repo.removeDeviceToken(token);
        }
      }
    }
  }

  async registerDevice(userId: string, token: string, platform: PlatformType, appType: AppType, language: string = "ar") {
    await this.repo.addDeviceToken({ userId, token, platform, appType, language, lastActive: new Date() });
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
