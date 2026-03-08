import axios, { AxiosInstance } from "axios";
import { adminServiceAuthenticator } from "../../../config/env";

export abstract class BaseClient {
  protected axiosInstance: AxiosInstance;

  constructor(protected baseUrl: string) {
    this.axiosInstance = axios.create({ baseURL: baseUrl });
  }

  protected async getRequestConfig(userId?: string) {
    const serviceToken = await adminServiceAuthenticator.getServiceToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serviceToken}`,
    };
    if (userId) {
      headers["X-User-Id"] = userId;
    }
    return { headers };
  }
}
