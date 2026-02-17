import axios, { AxiosInstance } from "axios";
import { adminServiceAuthenticator } from "../../config/env"; // Import the authenticator

export class ServiceClient {
  private axiosInstance: AxiosInstance;

  constructor(
    private orderServiceUrl: string,
    private vendorServiceUrl: string,
    private deliveryServiceUrl: string,
    private userServiceUrl: string,
    private authServiceUrl: string
  ) {
    this.axiosInstance = axios.create(); // Create base instance; headers will be dynamically added
  }

  private async getRequestConfig(userId?: string) {
    const serviceToken = await adminServiceAuthenticator.getServiceToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serviceToken}`,
    };
    if (userId) {
      headers["X-User-Id"] = userId; // Propagate user ID from validated context
    }
    return { headers };
  }

  async getAllOrders(page: number = 1, limit: number = 50, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.orderServiceUrl}/`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async getAllUsers(page: number = 1, limit: number = 50, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.userServiceUrl}/users`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async getAllVendors(page: number = 1, limit: number = 50, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.vendorServiceUrl}/`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async updateVendorCommission(vendorId: string, rate: number, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(
      `${this.vendorServiceUrl}/${vendorId}/commission`,
      { rate },
      config
    );
    return response.data;
  }

  async suspendVendor(vendorId: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(
      `${this.vendorServiceUrl}/${vendorId}/status`,
      { status: "SUSPENDED" },
      config
    );
    return response.data;
  }

  async getAllCouriers(page: number = 1, limit: number = 50, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.deliveryServiceUrl}/couriers`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async deactivateCourier(courierId: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(
      `${this.deliveryServiceUrl}/couriers/${courierId}/deactivate`,
      null,
      config
    );
    return response.data;
  }

  async getUserById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.userServiceUrl}/users/${id}`, config);
    return response.data;
  }

  async updateUserStatus(id: string, status: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`${this.userServiceUrl}/users/${id}/status`, { status }, config);
    return response.data;
  }

  async getVendorById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.vendorServiceUrl}/${id}`, config);
    return response.data;
  }

  async updateVendorStatus(id: string, status: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`${this.vendorServiceUrl}/${id}/status`, { status }, config);
    return response.data;
  }

  async getOrderById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.orderServiceUrl}/${id}`, config);
    return response.data;
  }

  async updateOrderStatus(id: string, status: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`${this.orderServiceUrl}/${id}/status`, { status }, config);
    return response.data;
  }

  async getDeliveries(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.deliveryServiceUrl}/deliveries`, config);
    return response.data;
  }

  async getAvailableCouriers(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.deliveryServiceUrl}/couriers/available`, config);
    return response.data;
  }
}
