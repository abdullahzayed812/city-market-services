import axios, { AxiosInstance } from "axios";
import { orderServiceAuthenticator } from "../../config/env";
import { Logger } from "@city-market/shared/node";

export class UserHttpClient {
  private axiosInstance: AxiosInstance;

  constructor(private baseUrl: string) {
    this.axiosInstance = axios.create();
  }

  private async getRequestConfig() {
    const serviceToken = await orderServiceAuthenticator.getServiceToken();
    return { headers: { Authorization: `Bearer ${serviceToken}` } };
  }

  async hasActivePenalty(userId: string): Promise<boolean> {
    try {
      const config = await this.getRequestConfig();
      const response = await this.axiosInstance.get(`${this.baseUrl}/customers/${userId}`, config);
      return response.data?.data?.hasPenalty === true;
    } catch (error: any) {
      Logger.warn(`Failed to check penalty for user ${userId}: ${error.message}`);
      return false;
    }
  }

  async getCustomerNamesByIds(customerIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(customerIds)];
    if (uniqueIds.length === 0) return new Map();

    try {
      const config = await this.getRequestConfig();
      const response = await this.axiosInstance.get(`${this.baseUrl}/customers`, {
        params: { ids: uniqueIds.join(",") },
        ...config,
      });
      const customers = response.data?.data ?? [];
      return new Map(customers.map((c: any) => [c.userId, c.fullName]));
    } catch (error: any) {
      Logger.warn(`Failed to fetch customer names: ${error.message}`);
      return new Map();
    }
  }
}
