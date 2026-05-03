import axios, { AxiosInstance } from "axios";
import { MeasurementType, WeightUnit } from "@city-market/shared";
import { orderServiceAuthenticator } from "../../config/env"; // Import the authenticator

export interface ProductInfo {
  id: string;
  vendorId: string;
  name: string;
  price: number;
  stockQuantity: number;
  stockWeight?: number;
  stockWeightGrams?: number;
  reservedWeightGrams?: number;
  measurementType: MeasurementType;
  weightUnit?: WeightUnit;
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

  async getVendorProduct(vendorProductId: string, userId?: string): Promise<ProductInfo | null> {
    // Changed to userId
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/products/${vendorProductId}`, config);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // async checkAndDecrementStock(vendorProductId: string, amount: number, userId?: string, type: MeasurementType = MeasurementType.UNIT): Promise<void> {
  //   // Changed to userId
  //   try {
  //     const config = await this.getRequestConfig(userId);
  //     const payload = type === MeasurementType.UNIT ? { stock: amount } : { weight: amount };
  //     const response = await this.axiosInstance.patch(`${this.baseUrl}/products/${vendorProductId}/decrement`, payload, config);
  //     if (!response.data?.success) {
  //       throw new Error(`Failed to decrement stock for product ${vendorProductId}: ${response.data.message || "Unknown reason"}`);
  //     }
  //   } catch (error: any) {
  //     throw new Error(`Catalog service stock decrement failed for product ${vendorProductId}: ${error.message}`);
  //   }
  // }

  // async reserveWeightStock(vendorProductId: string, weightGrams: number, userId?: string): Promise<void> {
  //   try {
  //     const config = await this.getRequestConfig(userId);
  //     const response = await this.axiosInstance.patch(
  //       `${this.baseUrl}/products/${vendorProductId}/reserve`,
  //       { weightGrams },
  //       config
  //     );
  //     if (!response.data?.success) {
  //       throw new Error(`Failed to reserve stock: ${response.data.message}`);
  //     }
  //   } catch (error: any) {
  //     throw new Error(`Catalog service stock reserve failed: ${error.message}`);
  //   }
  // }

  async releaseStock(vendorProductId: string, quantity: number, weightGrams: number, userId?: string): Promise<void> {
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.patch(`${this.baseUrl}/products/${vendorProductId}/release`, { quantity, weightGrams }, config);
      if (!response.data?.success) {
        throw new Error(`Failed to release stock: ${response.data.message}`);
      }
    } catch (error: any) {
      throw new Error(`Catalog service stock release failed: ${error.message}`);
    }
  }

  // async commitStock(vendorProductId: string, quantity: number, weightGrams: number, userId?: string): Promise<void> {
  //   try {
  //     const config = await this.getRequestConfig(userId);
  //     const response = await this.axiosInstance.patch(
  //       `${this.baseUrl}/products/${vendorProductId}/commit`,
  //       { quantity, weightGrams },
  //       config
  //     );
  //     if (!response.data?.success) {
  //       throw new Error(`Failed to commit stock: ${response.data.message}`);
  //     }
  //   } catch (error: any) {
  //     throw new Error(`Catalog service stock commit failed: ${error.message}`);
  //   }
  // }
}
