import apiClient from "./apiClient";
import type { Notification } from "@/types";

export const NotificationService = {
  getNotifications: async (page = 1, limit = 20): Promise<{ items: Notification[]; total: number; unread: number }> => {
    const response = await apiClient.get("/notification/notifications", {
      params: { page, limit },
    });
    return response.data?.data ?? { items: [], total: 0, unread: 0 };
  },

  markAsRead: async (id: string) => {
    const response = await apiClient.patch(`/notification/notifications/${id}/read`);
    return response.data?.data;
  },

  markAllAsRead: async () => {
    const response = await apiClient.patch("/notification/notifications/read-all");
    return response.data?.data;
  },

  /**
   * Registers a web FCM token with the backend notification service.
   * Called after the user grants notification permission and we obtain a token.
   */
  registerDeviceToken: async (token: string): Promise<void> => {
    await apiClient.post("/notification/device-token", {
      token,
      platform: "WEB",
      appType: "CUSTOMER",
    });
  },

  /**
   * Removes a specific FCM token from the backend.
   * Called on sign-out to stop notifications being sent to this browser.
   * Non-blocking — fire-and-forget.
   */
  unregisterDeviceToken: async (token: string): Promise<void> => {
    try {
      await apiClient.delete("/notification/device-token", { data: { token } });
    } catch {
      // Non-critical — stale tokens are cleaned up automatically by the backend
    }
  },
};
