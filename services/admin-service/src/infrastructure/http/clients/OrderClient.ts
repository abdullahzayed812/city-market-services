import { BaseClient } from "./BaseClient";

export class OrderClient extends BaseClient {
  async getAllOrders(page: number = 1, limit: number = 50, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async getOrderById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/customer-orders/${id}`, config);
    return response.data;
  }

  async updateOrderStatus(id: string, status: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/${id}/status`, { status }, config);
    return response.data;
  }
}
