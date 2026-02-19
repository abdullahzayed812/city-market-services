import axios, { AxiosInstance } from "axios";
import { Logger } from "@city-market/shared/node";
import { deliveryServiceAuthenticator } from "../../config/env";

export class VendorHttpClient {
  private readonly baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.axiosInstance = axios.create();
  }

  private async getRequestConfig(userId?: string) {
    const serviceToken = await deliveryServiceAuthenticator.getServiceToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serviceToken}`,
    };
    if (userId) {
      headers["X-User-Id"] = userId; // Propagate user ID from validated context
    }
    return { headers };
  }

  async getVendor(vendorId: string, userId?: string): Promise<any | null> {
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/${vendorId}`, config);
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
