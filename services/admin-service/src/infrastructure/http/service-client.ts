import axios, { AxiosInstance } from "axios";
import { adminServiceAuthenticator } from "../../config/env"; // Import the authenticator

export class ServiceClient {
  private axiosInstance: AxiosInstance;

  constructor(
    private orderServiceUrl: string,
    private vendorServiceUrl: string,
    private deliveryServiceUrl: string,
    private userServiceUrl: string,
    private authServiceUrl: string,
    private catalogServiceUrl: string,
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

  async getAllUsers(page: number = 1, limit: number = 50, userId?: string, role?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.authServiceUrl}/users`, {
      params: { page, limit, role },
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
      config,
    );
    return response.data;
  }

  async suspendVendor(vendorId: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(
      `${this.vendorServiceUrl}/${vendorId}/status`,
      { status: "SUSPENDED" },
      config,
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
      config,
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

  async getVendorsByIds(ids: string[], userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`${this.vendorServiceUrl}/bulk`, { ids }, config);
    return response.data;
  }

  async updateVendorStatus(id: string, status: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`${this.vendorServiceUrl}/${id}/status`, { status }, config);
    return response.data;
  }

  async uploadVendorImage(id: string, formData: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`${this.vendorServiceUrl}/${id}/image`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...(formData.getHeaders?.() || {}),
      },
    });
    return response.data;
  }

  async getOrderById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.orderServiceUrl}/customer-orders/${id}`, config);
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

  // Category Management
  async getAllCategories(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.catalogServiceUrl}/categories`, config);
    return response.data;
  }

  async getCategoryById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.catalogServiceUrl}/categories/${id}`, config);
    return response.data;
  }

  async createCategory(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`${this.catalogServiceUrl}/categories`, data, config);
    return response.data;
  }

  async updateCategory(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`${this.catalogServiceUrl}/categories/${id}`, data, config);
    return response.data;
  }

  async deleteCategory(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`${this.catalogServiceUrl}/categories/${id}`, config);
    return response.data;
  }

  async uploadCategoryIcon(id: string, formData: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`${this.catalogServiceUrl}/categories/${id}/icon`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...(formData.getHeaders?.() || {}), // Handle form-data headers if it's from form-data package or standard
      },
    });
    return response.data;
  }

  // Product Management
  async getAllProducts(
    page: number = 1,
    limit: number = 20,
    userId?: string,
    globalCategoryId?: string,
    vendorCategoryId?: string,
    vendorId?: string,
  ) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.catalogServiceUrl}/products`, {
      params: { page, limit, globalCategoryId, vendorCategoryId, vendorId },
      ...config,
    });
    return response.data;
  }

  async createProduct(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`${this.catalogServiceUrl}/products`, data, config);
    return response.data;
  }

  async updateProduct(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.put(`${this.catalogServiceUrl}/products/${id}`, data, config);
    return response.data;
  }

  async deleteProduct(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`${this.catalogServiceUrl}/products/${id}`, config);
    return response.data;
  }

  async uploadProductImage(id: string, formData: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`${this.catalogServiceUrl}/products/${id}/image`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...(formData.getHeaders?.() || {}),
      },
    });
    return response.data;
  }

  // Global Product Management
  async getGlobalProducts(page: number = 1, limit: number = 20, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`${this.catalogServiceUrl}/global-products`, {
      params: { page, limit },
      ...config,
    });
    return response.data;
  }

  async createGlobalProduct(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`${this.catalogServiceUrl}/global-products`, data, config);
    return response.data;
  }

  async updateGlobalProduct(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`${this.catalogServiceUrl}/global-products/${id}`, data, config);
    return response.data;
  }

  async deleteGlobalProduct(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`${this.catalogServiceUrl}/global-products/${id}`, config);
    return response.data;
  }
}
