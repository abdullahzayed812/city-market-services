import { INotificationRepository } from "../../core/interfaces/notification.repository";
import { Notification } from "../../core/entities/notification.entity";
import { AdminDirectory } from "../../infrastructure/clients/admin-directory";
import { randomUUID } from "crypto";
import { Logger } from "@city-market/shared/node";
import {
  AdminUnreadSummary,
  AppType,
  BaseEvent,
  EventType,
  ForbiddenError,
  PlatformType,
  UserRole,
  ValidationError,
  adminNotificationTarget,
  emptyAdminUnreadSummary,
  translate,
} from "@city-market/shared";

// Badges count at most this many unread notifications (older ones are still in the list)
const UNREAD_SCAN_LIMIT = 1000;

export interface PushSender {
  // Returns the tokens FCM reported as no longer valid
  sendMulticast(tokens: string[], title: string, body: string, data?: any): Promise<string[]>;
}

export interface SendOptions {
  // Unique per user; a repeated event with the same key creates nothing and sends no push
  dedupeKey?: string;
  // false = in-app only (stored and shown live, no FCM push)
  push?: boolean;
}

type Publish = (event: BaseEvent) => Promise<void>;

export class NotificationService {
  constructor(
    private repo: INotificationRepository,
    private pushProvider: PushSender,
    // Live updates (NOTIFICATION_CREATED / NOTIFICATION_READ) to the user's open apps
    private publish: Publish = async () => {},
    private admins?: AdminDirectory,
  ) { }

  // Returns the stored notification, or null when nothing was created (no user / duplicate)
  async sendNotification(
    userId: string,
    type: string,
    titleKey: string,
    messageKey: string,
    metadata?: Record<string, any>,
    options: SendOptions = {},
  ): Promise<Notification | null> {
    if (!userId) {
      Logger.error(`[NotificationService] Cannot send notification: userId is ${userId}. TitleKey: ${titleKey}`);
      return null;
    }

    // 1. Check Preferences
    let prefs = await this.repo.getPreferences(userId);
    if (!prefs) {
      // Default preferences if not found
      prefs = { userId, emailEnabled: true, pushEnabled: true, smsEnabled: false, updatedAt: new Date() };
      await this.repo.upsertPreferences(prefs);
    }

    // Default translation for saving to DB (in English or fallback)
    const truncatedMetadata = this.truncateMetadata(metadata);
    const dbTitle = translate(titleKey, 'en', truncatedMetadata);
    const dbMessage = translate(messageKey, 'en', truncatedMetadata);

    // 2. Save Notification. The translation keys are kept so apps can show it in their own language.
    const notification: Notification = {
      id: randomUUID(),
      userId,
      type,
      title: dbTitle,
      message: dbMessage,
      isRead: false,
      metadata: { ...metadata, titleKey, messageKey },
      dedupeKey: options.dedupeKey ?? null,
      createdAt: new Date(),
    };
    const created = await this.repo.create(notification);
    if (!created) {
      Logger.info(`[NotificationService] Duplicate ${type} for user ${userId} (${options.dedupeKey}); skipped`);
      return null;
    }
    await this.publishLive(EventType.NOTIFICATION_CREATED, { userId, notification });

    // 3. Dispatch Push
    if (prefs.pushEnabled && options.push !== false) {
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
          const truncatedMetadata = this.truncateMetadata(metadata);
          const translatedTitle = translate(titleKey, lang, truncatedMetadata);
          const translatedMessage = translate(messageKey, lang, truncatedMetadata);

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
    return notification;
  }

  // One notification per active admin. `dedupeKey` should identify the source event, so a
  // redelivered event (or a retry after one admin failed) never notifies an admin twice.
  async sendToAdmins(type: string, titleKey: string, messageKey: string, metadata: Record<string, any>, options: SendOptions = {}) {
    if (!this.admins) {
      Logger.warn(`[NotificationService] No admin directory configured; ${type} not sent`);
      return 0;
    }
    const adminIds = await this.admins.listAdminUserIds();
    let sent = 0;
    for (const adminId of adminIds) {
      const created = await this.sendNotification(adminId, type, titleKey, messageKey, { ...metadata, role: UserRole.ADMIN }, options);
      if (created) sent++;
    }
    return sent;
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
      const truncatedMetadata = this.truncateMetadata(metadata);
      const translatedTitle = translate(titleKey, lang, truncatedMetadata);
      const translatedMessage = translate(messageKey, lang, truncatedMetadata);

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

  async registerDevice(userId: string, role: string, token: string, platform: PlatformType, appType: AppType, language: string = "ar") {
    if (typeof token !== "string" || !token.trim() || token.length > 500) throw new ValidationError("invalid_device_token");
    if (!Object.values(PlatformType).includes(platform)) throw new ValidationError("invalid_platform");
    if (!Object.values(AppType).includes(appType)) throw new ValidationError("invalid_app_type");
    // The admin app's devices are only ever registered by admins
    if (appType === AppType.ADMIN && role !== UserRole.ADMIN) throw new ForbiddenError("app_type_not_allowed");
    await this.repo.addDeviceToken({ userId, token: token.trim(), platform, appType, language, lastActive: new Date() });
  }

  // Sign-out: this device stops receiving the user's pushes
  async unregisterDevice(userId: string, token: string) {
    if (typeof token !== "string" || !token.trim()) throw new ValidationError("invalid_device_token");
    await this.repo.removeUserDeviceToken(userId, token.trim());
  }

  async getPreferences(userId: string) {
    const prefs = await this.repo.getPreferences(userId);
    return { pushEnabled: prefs?.pushEnabled ?? true };
  }

  async updatePreferences(userId: string, body: { pushEnabled?: unknown }) {
    if (typeof body?.pushEnabled !== "boolean") throw new ValidationError("push_enabled_must_be_boolean");
    const current = await this.repo.getPreferences(userId);
    await this.repo.upsertPreferences({
      userId,
      pushEnabled: body.pushEnabled,
      emailEnabled: current?.emailEnabled ?? true,
      smsEnabled: current?.smsEnabled ?? false,
      updatedAt: new Date(),
    });
    return { pushEnabled: body.pushEnabled };
  }

  async getNotifications(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const [items, total, unread] = await Promise.all([
      this.repo.findByUserId(userId, limit, offset),
      this.repo.countAll(userId),
      this.repo.countUnread(userId),
    ]);
    return { items, total, unread };
  }

  // Read state lives here, not on the device: every open app of this user is told (web <-> phone)
  async markAsRead(userId: string, notificationId: string) {
    const changed = await this.repo.markAsRead(userId, notificationId);
    if (changed) await this.publishLive(EventType.NOTIFICATION_READ, { userId, ids: [notificationId] });
  }

  async markAllRead(userId: string) {
    const changed = await this.repo.markAllAsRead(userId);
    if (changed > 0) await this.publishLive(EventType.NOTIFICATION_READ, { userId, all: true });
  }

  // Unread admin notifications grouped by the screen they open (see AdminUnreadSummary)
  async getUnreadSummary(userId: string): Promise<AdminUnreadSummary> {
    const summary = emptyAdminUnreadSummary();
    for (const n of await this.repo.findUnread(userId, UNREAD_SCAN_LIMIT)) {
      const target = adminNotificationTarget(n.metadata);
      if (target && !summary[target.screen].includes(target.id)) summary[target.screen].push(target.id);
    }
    return summary;
  }

  // The admin opened this item: every unread notification that leads to it is read now
  async markTargetRead(userId: string, screen: unknown, id: unknown) {
    if (typeof screen !== "string" || !(screen in emptyAdminUnreadSummary())) throw new ValidationError("invalid_target");
    if (typeof id !== "string" || !id) throw new ValidationError("invalid_target");
    const ids = (await this.repo.findUnread(userId, UNREAD_SCAN_LIMIT))
      .filter((n) => {
        const target = adminNotificationTarget(n.metadata);
        return target?.screen === screen && target.id === id;
      })
      .map((n) => n.id);
    const changed = await this.repo.markManyAsRead(userId, ids);
    if (changed > 0) await this.publishLive(EventType.NOTIFICATION_READ, { userId, ids });
    return changed;
  }

  // Best effort: the notification is stored either way, and apps resync on reconnect
  private async publishLive(type: EventType, payload: Record<string, unknown>) {
    try {
      await this.publish({ id: randomUUID(), type, timestamp: new Date(), payload });
    } catch (error: any) {
      Logger.warn(`[NotificationService] ${type} publish failed: ${error?.message}`);
    }
  }

  private truncateMetadata(metadata?: Record<string, any>): Record<string, any> {
    if (!metadata) return {};
    const truncated = { ...metadata };
    const keysToTruncate = ['orderId', 'customerOrderId', 'vendorOrderId', 'deliveryId', 'ratingId'];

    for (const key of keysToTruncate) {
      if (truncated[key] && typeof truncated[key] === 'string' && truncated[key].length > 6) {
        truncated[key] = truncated[key].substring(0, 6);
      }
    }
    return truncated;
  }
}
