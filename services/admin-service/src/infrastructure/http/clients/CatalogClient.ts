import { BaseClient } from "./BaseClient";
import type { BulkAddVendorProductsFromGlobalItem } from "@city-market/shared";

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

  async updateCategoryIcon(id: string, iconUrl: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/categories/${id}/icon`, { iconUrl }, config);
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
    search?: string,
  ) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/products`, {
      params: { page, limit, globalCategoryId, vendorCategoryId, vendorId, search },
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
    const response = await this.axiosInstance.patch(`/products/${id}`, data, config);
    return response.data;
  }

  async deleteProduct(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.delete(`/products/${id}`, config);
    return response.data;
  }

  async updateProductImage(id: string, imageUrl: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.patch(`/products/${id}/image`, { imageUrl }, config);
    return response.data;
  }

  async bulkAddVendorProductsFromGlobal(vendorId: string, data: { items: BulkAddVendorProductsFromGlobalItem[] }, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/products/vendor/${vendorId}/bulk-add-global`, data, config);
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

  async bulkCreateGlobalProducts(data: any, userId?: string) {
    const config = await this.getRequestConfig(userId);
    // Downloading and processing every row's image can take a while — give this
    // call more headroom than the default axios timeout.
    const response = await this.axiosInstance.post(`/global-products/bulk`, data, {
      ...config,
      timeout: 120_000,
    });
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
