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

  async getOrderStats(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/stats`, config);
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

  // async getVendorFinancials(vendorId: string, periodStart?: string, periodEnd?: string, userId?: string) {
  //   const config = await this.getRequestConfig(userId);
  //   const params: any = {};
  //   if (periodStart) params.periodStart = periodStart;
  //   if (periodEnd) params.periodEnd = periodEnd;

  //   const response = await this.axiosInstance.get(`/vendor/${vendorId}/financials`, {
  //     params,
  //     ...config,
  //   });
  //   return response.data;
  // }

  async getCommissionTiers(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/commission-tiers`, config);
    return response.data;
  }

  async createCommissionTier(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/commission-tiers`, data, config);
    return response.data;
  }

  async updateCommissionTier(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/commission-tiers/${id}`, data, config);
    return response.data;
  }

  async deleteCommissionTier(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`/commission-tiers/${id}`, config);
    return response.data;
  }

  async getVendorPendingEarnings(vendorId: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/settlements/vendor/${vendorId}/pending`, config);
    return response.data;
  }

  async getSettlements(vendorId?: string, page: number = 1, limit: number = 20, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const params: any = { page, limit };
    if (vendorId) params.vendorId = vendorId;
    const response = await this.axiosInstance.get(`/settlements`, { params, ...config });
    return response.data;
  }

  async createSettlement(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/settlements`, data, config);
    return response.data;
  }

  async markSettlementPaid(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/settlements/${id}/mark-paid`, {}, config);
    return response.data;
  }

  async getPlatformFinancialOverview(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/settlements/overview`, config);
    return response.data;
  }
}
