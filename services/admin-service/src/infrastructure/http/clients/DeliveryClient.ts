import { BaseClient } from "./BaseClient";

export class DeliveryClient extends BaseClient {
  async getAllCouriers(page: number = 1, limit: number = 50, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/couriers`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async getAvailableCouriers(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/couriers/available`, config);
    return response.data;
  }

  async registerCourier(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/couriers`, data, config);
    return response.data;
  }

  async deactivateCourier(courierId: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/couriers/${courierId}/deactivate`, null, config);
    return response.data;
  }

  async getDeliveries(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/deliveries`, config);
    return response.data;
  }

  async getDeliveriesAnalytics(vendorOrderIds: string[], periodStart?: string, periodEnd?: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const params: any = { vendorOrderIds: vendorOrderIds.join(',') };
    if (periodStart) params.periodStart = periodStart;
    if (periodEnd) params.periodEnd = periodEnd;

    const response = await this.axiosInstance.get(`/deliveries-analytics`, {
      params,
      ...config,
    });
    return response.data;
  }
}
