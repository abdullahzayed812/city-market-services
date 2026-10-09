import apiClient, { APP_ID } from "./client";
import { getOrCreateDeviceId } from "@/utils/deviceId";

export const authService = {
  login: async (credentials: any) => {
    const response = await apiClient.post("/auth/login", {
      ...credentials,
      deviceId: getOrCreateDeviceId(),
      platform: "web",
      appId: APP_ID,
    });
    return response.data?.data;
  },
  // Public signup: always a DELIVERY_MANAGER account; the office (and admin approval) comes next
  register: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post("/auth/register", {
      ...credentials,
      role: "DELIVERY_MANAGER",
      deviceId: getOrCreateDeviceId(),
      platform: "web",
      appId: APP_ID,
    });
    return response.data?.data;
  },
  logout: async () => {
    const response = await apiClient.post("/auth/logout", { appId: APP_ID });
    return response.data?.data;
  },
  logoutAll: async () => {
    const response = await apiClient.post("/auth/logout-all", { appId: APP_ID });
    return response.data?.data;
  },
  refreshToken: async () => {
    const response = await apiClient.post("/auth/refresh", { deviceId: getOrCreateDeviceId(), platform: "web", appId: APP_ID });
    return response.data?.data;
  },
};
