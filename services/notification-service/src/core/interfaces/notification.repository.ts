import { Notification, NotificationPreference, DeviceToken } from "../entities/notification.entity";

export interface INotificationRepository {
  // Notifications
  // false when a notification with the same (userId, dedupeKey) already exists
  create(notification: Notification): Promise<boolean>;
  findByUserId(userId: string, limit: number, offset: number): Promise<Notification[]>;
  countAll(userId: string): Promise<number>;
  // Only the owner's notification; returns whether it changed
  markAsRead(userId: string, id: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<number>;
  // The owner's unread notifications with the given ids; returns how many changed
  markManyAsRead(userId: string, ids: string[]): Promise<number>;
  // Newest unread first (id, type, metadata are what the summary needs)
  findUnread(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;

  // Preferences
  getPreferences(userId: string): Promise<NotificationPreference | null>;
  upsertPreferences(pref: NotificationPreference): Promise<void>;

  // Device Tokens
  addDeviceToken(token: DeviceToken): Promise<void>;
  removeDeviceToken(token: string): Promise<void>;
  removeUserDeviceToken(userId: string, token: string): Promise<void>;
  getDeviceTokens(userId: string): Promise<DeviceToken[]>;
  getTokensByAppType(appType: string): Promise<DeviceToken[]>;
}
