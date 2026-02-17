import axios, { AxiosInstance } from "axios";
import { Logger } from "@city-market/shared/node";
import { orderServiceAuthenticator } from "../../config/env"; // Import the authenticator

export interface VendorInfo {
  id: string;
  userId: string;
  shopName: string;
  address: string;
  status: string;
  latitude: number;
  longitude: number;
}

export class VendorHttpClient {
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

  async getVendor(vendorId: string, userId?: string): Promise<VendorInfo | null> {
    // Changed to userId
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/${vendorId}`, config); // Passed config
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      Logger.error(`Failed to fetch vendor ${vendorId}`, error);
      return null;
    }
  }
}
