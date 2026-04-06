import axios, { AxiosInstance } from "axios";
import { Logger } from "@city-market/shared/node";
import { IVendorClient, VendorInfo } from "../../core/interfaces/IVendorClient";
import { ratingServiceAuthenticator } from "../../config/env";

export class VendorHttpClient implements IVendorClient {
  private axiosInstance: AxiosInstance;

  constructor(private baseUrl: string) {
    this.axiosInstance = axios.create();
  }

  private async getRequestConfig(userId?: string) {
    const serviceToken = await ratingServiceAuthenticator.getServiceToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serviceToken}`,
    };
    if (userId) {
      headers["X-User-Id"] = userId;
    }
    return { headers };
  }

  async getVendor(vendorId: string, userId?: string): Promise<VendorInfo | null> {
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/${vendorId}`, config);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      Logger.error(`Failed to fetch vendor ${vendorId} from Vendor Service`, error);
      return null;
    }
  }
}
