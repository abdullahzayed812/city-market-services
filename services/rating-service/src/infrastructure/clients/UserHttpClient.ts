import axios, { AxiosInstance } from "axios";
import { Logger } from "@city-market/shared/node";
import { IUserClient, UserInfo } from "../../core/interfaces/IUserClient";
import { ratingServiceAuthenticator } from "../../config/env";

export class UserHttpClient implements IUserClient {
  private axiosInstance: AxiosInstance;

  constructor(private baseUrl: string) {
    this.axiosInstance = axios.create();
  }

  private async getRequestConfig(currentUserId?: string) {
    const serviceToken = await ratingServiceAuthenticator.getServiceToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serviceToken}`,
    };
    if (currentUserId) {
      headers["X-User-Id"] = currentUserId;
    }
    return { headers };
  }

  async getCustomerByUserId(userId: string): Promise<UserInfo | null> {
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/customers/${userId}`, config);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      Logger.error(`Failed to fetch customer ${userId} from User Service`, error);
      return null;
    }
  }

  async getCustomersByIds(ids: string[], currentUserId?: string): Promise<UserInfo[]> {
    if (ids.length === 0) return [];
    try {
      const config = await this.getRequestConfig(currentUserId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/customers`, {
        ...config,
        params: { ids: ids.join(",") },
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      Logger.error(`Failed to fetch customers batch from User Service`, error);
      return [];
    }
  }
}
