import { AppType, PlatformType } from "@city-market/shared";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
}

export interface NotificationPreference {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  updatedAt: Date;
}

export interface DeviceToken {
  userId: string;
  token: string;
  platform: PlatformType;
  appType: AppType;
  language?: string;
  lastActive: Date;
}
