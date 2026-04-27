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
}
