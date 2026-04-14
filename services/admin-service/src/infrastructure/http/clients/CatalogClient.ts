import { BaseClient } from "./BaseClient";

export class CatalogClient extends BaseClient {
  // Category Management
  async getAllCategories(userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/categories`, config);
    return response.data;
  }

  async getCategoryById(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/categories/${id}`, config);
    return response.data;
  }

  async createCategory(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/categories`, data, config);
    return response.data;
  }

  async updateCategory(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/categories/${id}`, data, config);
    return response.data;
  }

  async deleteCategory(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`/categories/${id}`, config);
    return response.data;
  }

  async uploadCategoryIcon(id: string, formData: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/categories/${id}/icon`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...(formData.getHeaders?.() || {}),
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
    const response = await this.axiosInstance.get(`/products`, {
      params: { page, limit, globalCategoryId, vendorCategoryId, vendorId },
      ...config,
    });
    return response.data;
  }

  async createProduct(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/products`, data, config);
    return response.data;
  }

  async updateProduct(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.put(`/products/${id}`, data, config);
    return response.data;
  }

  async deleteProduct(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`/products/${id}`, config);
    return response.data;
  }

  async uploadProductImage(id: string, formData: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/products/${id}/image`, formData, {
      ...config,
      headers: {
        ...config.headers,
        ...(formData.getHeaders?.() || {}),
      },
    });
    return response.data;
  }

  // Global Product Management
  async getGlobalProducts(page: number = 1, limit: number = 20, search?: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/global-products`, {
      params: { page, limit, search },
      ...config,
    });
    return response.data;
  }

  async createGlobalProduct(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/global-products`, data, config);
    return response.data;
  }

  async updateGlobalProduct(id: string, data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/global-products/${id}`, data, config);
    return response.data;
  }

  async deleteGlobalProduct(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`/global-products/${id}`, config);
    return response.data;
  }
}
