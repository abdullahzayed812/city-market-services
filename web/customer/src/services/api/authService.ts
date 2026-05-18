import apiClient from './apiClient';

export const AuthService = {
  register: async (userData: { email: string; password: string; fullName: string; phone?: string }) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data?.data;
  },
  login: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data?.data;
  },
  logout: async (refreshToken: string) => {
    const response = await apiClient.post('/auth/logout', { refreshToken });
    return response.data?.data;
  },
  refresh: async (refreshToken: string) => {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data?.data;
  },
};
