import axios, { AxiosInstance } from "axios";
import { CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";
import { deliveryServiceAuthenticator } from "../../config/env"; // Import the authenticator

export class OrderHttpClient {
  private readonly baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.axiosInstance = axios.create(); // Create base instance; headers will be dynamically added
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

  async getOrder(orderId: string, userId?: string): Promise<any> {
    // Changed to userId
    try {
      const config = await this.getRequestConfig(userId);
      const response = await this.axiosInstance.get(`${this.baseUrl}/customer-orders/${orderId}`, config);
      return response?.data?.data;
    } catch (error: any) {
      console.error(`Failed to fetch customer order ${orderId}:`, error.message);
      throw error;
    }
  }

  // async updateCustomerOrderStatus(orderId: string, status: CustomerOrderStatus, userId?: string): Promise<void> { // Changed to userId
  //   try {
  //     const config = await this.getRequestConfig(userId);
  //     await this.axiosInstance.patch(
  //       `${this.baseUrl}/customer-orders/${orderId}/status`,
  //       { status },
  //       config
  //     );
  //   } catch (error: any) {
  //     console.error(`Failed to update customer order status for ${orderId}:`, error.message);
  //     throw error;
  //   }
  // }

  // async updateVendorOrderStatus(vendorOrderId: string, status: VendorOrderStatus, userId?: string): Promise<void> { // Changed to userId
  //   try {
  //     const config = await this.getRequestConfig(userId);
  //     await this.axiosInstance.patch(
  //       `${this.baseUrl}/vendor-orders/${vendorOrderId}/status`,
  //       { status },
  //       config
  //     );
  //   } catch (error: any) {
  //     console.error(`Failed to update vendor order status for ${vendorOrderId}:`, error.message);
  //     throw error;
  //   }
  // }
}
