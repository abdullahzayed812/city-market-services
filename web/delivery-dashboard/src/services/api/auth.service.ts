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
