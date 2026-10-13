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
  // Public signup is always a VENDOR account; the store application and admin review come next
  register: async (data: { email: string; password: string }) => {
    const response = await apiClient.post("/auth/register", {
      ...data,
      role: "VENDOR",
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
