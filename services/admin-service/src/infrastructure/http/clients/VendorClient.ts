import { BaseClient } from "./BaseClient";

export class VendorClient extends BaseClient {
  async getAllVendors(page: number = 1, limit: number = 50, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async getVendorById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/${id}`, config);
    return response.data;
  }

  async getVendorsByIds(ids: string[], userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/bulk`, { ids }, config);
    return response.data;
  }

  async createVendor(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/`, data, config);
    return response.data;
  }

  async updateVendorCommission(vendorId: string, rate: number, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/${vendorId}/commission`, { rate }, config);
    return response.data;
  }

  async updateVendorStatus(id: string, status: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/${id}/status`, { status }, config);
    return response.data;
  }

  async suspendVendor(vendorId: string, userId?: string) {
    return this.updateVendorStatus(vendorId, "SUSPENDED", userId);
  }

  async uploadVendorImage(id: string, formData: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/${id}/image`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...(formData.getHeaders?.() || {}),
      },
    });
    return response.data;
  }
}
