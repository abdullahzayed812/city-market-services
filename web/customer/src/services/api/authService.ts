import apiClient, { APP_ID } from './apiClient';
import { getOrCreateDeviceId } from '@/utils/deviceId';

export const AuthService = {
  register: async (userData: { email: string; password: string; fullName: string; phone?: string }) => {
    const response = await apiClient.post('/auth/register', {
      ...userData,
      role: 'CUSTOMER',
      deviceId: getOrCreateDeviceId(),
      platform: 'web',
      appId: APP_ID,
    });
    return response.data?.data;
  },
  login: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/login', {
      ...credentials,
      deviceId: getOrCreateDeviceId(),
      platform: 'web',
      appId: APP_ID,
    });
    return response.data?.data;
  },
  logout: async () => {
    const response = await apiClient.post('/auth/logout', { appId: APP_ID });
    return response.data?.data;
  },
  logoutAll: async () => {
    const response = await apiClient.post('/auth/logout-all', { appId: APP_ID });
    return response.data?.data;
  },
  refresh: async () => {
    const response = await apiClient.post('/auth/refresh', { deviceId: getOrCreateDeviceId(), appId: APP_ID });
    return response.data?.data;
  },
};
