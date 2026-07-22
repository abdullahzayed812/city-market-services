import { BaseClient } from "./BaseClient";

export class AuthClient extends BaseClient {
  async getAllUsers(page: number = 1, limit: number = 50, userId?: string, role?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/users`, {
      params: { page, limit, role },
      ...config,
    });
    return response.data;
  }

  async getUsersCount(userId?: string, role?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/users/count`, {
      params: { role },
      ...config,
    });
    return response.data;
  }

  async register(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/register`, data, config);
    return response.data;
  }
}
