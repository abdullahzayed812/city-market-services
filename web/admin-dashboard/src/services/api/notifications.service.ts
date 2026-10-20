import axiosInstance from "./axios-instance";
import type { ApiResponse } from "@city-market/shared";

export interface AdminNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationPage {
  items: AdminNotification[];
  total: number;
  unread: number;
}

// Same notification-service API and rows as the admin mobile app: read state is shared
export const notificationsApi = {
  list: async (page = 1, limit = 20) =>
    (await axiosInstance.get<ApiResponse<NotificationPage>>("/notification/notifications", { params: { page, limit } })).data.data!,
  markRead: (id: string) => axiosInstance.patch<ApiResponse<null>>(`/notification/notifications/${id}/read`),
  markAllRead: () => axiosInstance.patch<ApiResponse<null>>("/notification/notifications/read-all"),
};
