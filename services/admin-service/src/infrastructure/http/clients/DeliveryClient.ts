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

  async getAllDeliveryOffices(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/delivery-offices`, config);
    return response.data;
  }

  async getCourierPendingEarnings(courierId: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/courier-settlements/courier/${courierId}/pending`, config);
    return response.data;
  }

  async getCourierSettlements(courierId?: string, limit = 10, offset = 0, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const params: any = { limit, offset };
    if (courierId) params.courierId = courierId;
    const response = await this.axiosInstance.get(`/courier-settlements`, { params, ...config });
    return response.data;
  }

  async createCourierSettlement(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/courier-settlements`, data, config);
    return response.data;
  }

  async markCourierSettlementPaid(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/courier-settlements/${id}/mark-paid`, {}, config);
    return response.data;
  }

  async getOfficePendingEarnings(deliveryOfficeId?: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const params: any = {};
    if (deliveryOfficeId) params.deliveryOfficeId = deliveryOfficeId;
    const response = await this.axiosInstance.get(`/office-settlements/pending`, { params, ...config });
    return response.data;
  }

  async getOfficeSettlements(deliveryOfficeId?: string, limit = 10, offset = 0, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const params: any = { limit, offset };
    if (deliveryOfficeId) params.deliveryOfficeId = deliveryOfficeId;
    const response = await this.axiosInstance.get(`/office-settlements`, { params, ...config });
    return response.data;
  }

  async createOfficeSettlement(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/office-settlements`, data, config);
    return response.data;
  }

  async markOfficeSettlementPaid(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/office-settlements/${id}/mark-paid`, {}, config);
    return response.data;
  }

  async getAllDeliveryFeeTiers(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/delivery-fee-tiers`, config);
    return response.data;
  }

  async createDeliveryFeeTier(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/delivery-fee-tiers`, data, config);
    return response.data;
  }

  async updateDeliveryFeeTier(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/delivery-fee-tiers/${id}`, data, config);
    return response.data;
  }

  async deleteDeliveryFeeTier(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`/delivery-fee-tiers/${id}`, config);
    return response.data;
  }
}
