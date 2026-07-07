import apiClient from './apiClient';
import { getOrCreateDeviceId } from '@/utils/deviceId';

export const AuthService = {
  register: async (userData: { email: string; password: string; fullName: string; phone?: string }) => {
    const response = await apiClient.post('/auth/register', {
      ...userData,
      deviceId: getOrCreateDeviceId(),
      platform: 'web',
    });
    return response.data?.data;
  },
  login: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/login', {
      ...credentials,
      deviceId: getOrCreateDeviceId(),
      platform: 'web',
    });
    return response.data?.data;
  },
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data?.data;
  },
  logoutAll: async () => {
    const response = await apiClient.post('/auth/logout-all');
    return response.data?.data;
  },
  refresh: async () => {
    const response = await apiClient.post('/auth/refresh', { deviceId: getOrCreateDeviceId() });
    return response.data?.data;
  },
};
