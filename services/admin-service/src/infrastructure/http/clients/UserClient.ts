import { BaseClient } from "./BaseClient";

export class UserClient extends BaseClient {
  async getUserById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/users/${id}`, config);
    return response.data;
  }

  // Customer profile (user-service) by auth user id
  async getCustomerByUserId(userId: string, adminUserId?: string) {
    const config = await this.getRequestConfig(adminUserId);
    const response = await this.axiosInstance.get(`/customers/${userId}`, config);
    return response.data;
  }

  async updateUserStatus(id: string, status: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/users/${id}/status`, { status }, config);
    return response.data;
  }
}
