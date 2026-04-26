import axios, { AxiosInstance } from "axios";
import { Logger } from "@city-market/shared/node";
import { deliveryServiceAuthenticator } from "../../config/env";

export class UserHttpClient {
  private readonly baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.axiosInstance = axios.create();
  }

  private async getRequestConfig() {
    const serviceToken = await deliveryServiceAuthenticator.getServiceToken();
    return { headers: { Authorization: `Bearer ${serviceToken}` } };
  }

  async getCustomerPhone(userId: string): Promise<string | null> {
    try {
      const config = await this.getRequestConfig();
      const response = await this.axiosInstance.get(
        `${this.baseUrl}/customers/${userId}`,
        config,
      );
      return response.data?.data?.phone ?? null;
    } catch (error) {
      Logger.warn(`Failed to fetch customer phone for user ${userId}`);
      return null;
    }
  }
}
