import axios, { AxiosInstance } from "axios";
import { randomUUID } from "crypto";
import { ValidationError } from "@city-market/shared";
import { deliveryServiceAuthenticator } from "../../config/env";

export class AuthHttpClient {
  private axiosInstance: AxiosInstance;

  constructor(private readonly baseUrl: string) {
    this.axiosInstance = axios.create();
  }

  // Creates a COURIER login (for a courier added by their office manager); returns the user id.
  // Auth errors such as "email already registered" are passed through as validation errors.
  async registerCourierUser(email: string, password: string, fullName: string): Promise<string> {
    const serviceToken = await deliveryServiceAuthenticator.getServiceToken();
    try {
      const response = await this.axiosInstance.post(
        `${this.baseUrl}/register`,
        { email, password, role: "COURIER", firstName: fullName, deviceId: randomUUID(), platform: "web" },
        { headers: { Authorization: `Bearer ${serviceToken}` } },
      );
      const userId = response.data?.data?.user?.id;
      if (!userId) throw new Error("auth register returned no user id");
      return userId;
    } catch (error: any) {
      const message = error.response?.data?.message;
      if (error.response?.status && error.response.status < 500 && message) throw new ValidationError(message);
      throw error;
    }
  }

  // Role of an auth user, or null if the user doesn't exist. Other failures throw so
  // a courier profile is never created on an unverified user.
  async getUserRole(userId: string): Promise<string | null> {
    const serviceToken = await deliveryServiceAuthenticator.getServiceToken();
    try {
      const response = await this.axiosInstance.get(`${this.baseUrl}/users/${userId}`, {
        headers: { Authorization: `Bearer ${serviceToken}` },
      });
      return response.data?.data?.role ?? null;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }
}
