import axiosInstance, { APP_ID } from "./axios-instance";
import { getOrCreateDeviceId } from "../../utils/deviceId";

export const authService = {
  login: async (credentials: any) => {
    const response = await axiosInstance.post("/auth/login", {
      ...credentials,
      deviceId: getOrCreateDeviceId(),
      platform: "web",
      appId: APP_ID,
    });
    return response.data.data;
  },
  logout: async () => {
    const response = await axiosInstance.post("/auth/logout", { appId: APP_ID });
    return response.data.data;
  },
  logoutAll: async () => {
    const response = await axiosInstance.post("/auth/logout-all", { appId: APP_ID });
    return response.data.data;
  },
  refreshToken: async () => {
    const response = await axiosInstance.post("/auth/refresh", { deviceId: getOrCreateDeviceId(), platform: "web", appId: APP_ID });
    return response.data.data;
  },
};
