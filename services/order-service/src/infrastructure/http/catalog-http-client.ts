import axios, { AxiosInstance } from "axios";
import { orderServiceAuthenticator } from "../../config/env"; // Import the authenticator

export interface ProductInfo {
  id: string;
  vendorId: string;
  name: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
}

export class CatalogHttpClient {
  private axiosInstance: AxiosInstance;

  constructor(private baseUrl: string) {
    this.axiosInstance = axios.create(); // Create base instance; headers will be dynamically added
  }

  private async getRequestConfig(userId?: string) {
    const serviceToken = await orderServiceAuthenticator.getServiceToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serviceToken}`,
    };
    if (userId) {
      headers["X-User-Id"] = userId; // Propagate user ID from validated context
    }
    return { headers };
  }

  async getProduct(productId: string, userId?: string): Promise<ProductInfo | null> {
    // Changed to userId
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/products/${productId}`, config);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async checkAndDecrementStock(productId: string, quantity: number, userId?: string): Promise<void> {
    // Changed to userId
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.patch(
        `${this.baseUrl}/products/${productId}/stock`,
        { stock: quantity },
        config
      );
      if (!response.data?.success) {
        throw new Error(
          `Failed to decrement stock for product ${productId}: ${response.data.message || "Unknown reason"}`
        );
      }
    } catch (error: any) {
      throw new Error(`Catalog service stock decrement failed for product ${productId}: ${error.message}`);
    }
  }
}
