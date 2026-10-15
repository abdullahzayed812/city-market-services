import axios, { AxiosResponse } from "axios";
import { AppError } from "@city-market/shared";
import { BaseClient } from "./BaseClient";
import type { BulkAddVendorProductsFromGlobalItem } from "@city-market/shared";

// catalog-service's own status and body (e.g. 409 with the duplicate matches), passed through
// to the dashboard instead of a generic 500
export class DownstreamError extends AppError {
  constructor(
    statusCode: number,
    public readonly body: unknown,
  ) {
    super(statusCode, (body as { message?: string } | null)?.message ?? "downstream_error");
    Object.setPrototypeOf(this, DownstreamError.prototype);
  }
}

async function passThrough<T>(request: Promise<AxiosResponse<T>>): Promise<T> {
  try {
    return (await request).data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
      throw new DownstreamError(error.response.status, error.response.data);
    }
    throw error;
  }
}

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

  async bulkAddVendorProductsFromGlobal(vendorId: string, data: { items: BulkAddVendorProductsFromGlobalItem[] } | { globalCategoryId: string }, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.post(`/products/vendor/${vendorId}/bulk-add-global`, data, config);
    return response.data;
  }

  // Global Product Management
  async getGlobalProducts(page: number = 1, limit: number = 20, search?: string, userId?: string, globalCategoryId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/global-products`, {
      params: { page, limit, search, globalCategoryId },
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

  // Merchant product proposals (review queue)
  async getProductSubmissions(params: Record<string, unknown>, userId?: string) {
    const config = await this.getRequestConfig(userId);
    return passThrough(this.axiosInstance.get(`/admin/product-submissions`, { params, ...config }));
  }

  async getProductSubmission(id: string, userId?: string) {
    const config = await this.getRequestConfig(userId);
    return passThrough(this.axiosInstance.get(`/admin/product-submissions/${encodeURIComponent(id)}`, config));
  }

  async decideProductSubmission(id: string, decision: "approve" | "link" | "reject" | "request-changes", body: unknown, userId?: string) {
    const config = await this.getRequestConfig(userId);
    // Approval copies the photo to the public catalog first: allow more than the default
    return passThrough(
      this.axiosInstance.post(`/admin/product-submissions/${encodeURIComponent(id)}/${decision}`, body, { ...config, timeout: 60_000 }),
    );
  }
}
