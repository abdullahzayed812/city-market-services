import { Notification, NotificationPreference, DeviceToken } from "../entities/notification.entity";

export interface INotificationRepository {
  // Notifications
  create(notification: Notification): Promise<Notification>;
  findByUserId(userId: string, limit: number, offset: number): Promise<Notification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  countUnread(userId: string): Promise<number>;

  // Preferences
  getPreferences(userId: string): Promise<NotificationPreference | null>;
  upsertPreferences(pref: NotificationPreference): Promise<void>;

  // Device Tokens
  addDeviceToken(token: DeviceToken): Promise<void>;
  removeDeviceToken(token: string): Promise<void>;
  getDeviceTokens(userId: string): Promise<DeviceToken[]>;
}
