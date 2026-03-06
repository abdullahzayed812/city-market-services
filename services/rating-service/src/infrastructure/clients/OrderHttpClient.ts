import axios, { AxiosInstance } from "axios";
import { Logger } from "@city-market/shared/node";
import { IOrderClient, OrderInfo } from "../../core/interfaces/IOrderClient";
import { ratingServiceAuthenticator } from "../../config/env";

export class OrderHttpClient implements IOrderClient {
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

  async getOrder(orderId: string, userId?: string): Promise<OrderInfo | null> {
    try {
      const config = await this.getRequestConfig(userId);
      // Assuming order service has GET /customer-orders/:id or similar that returns full order details
      // Based on order-service routes: router.get("/customer-orders/:id", controller.getCustomerOrderById);
      const response = await this.axiosInstance.get(`${this.baseUrl}/customer-orders/${orderId}`, config);
      if (response.data.success && response.data.data) {
        const orderData = response.data.data.order;
        const vendorOrders = response.data.data.vendorOrders;
        return {
          id: orderData.id,
          customerId: orderData.customerId,
          status: orderData.status,
          vendorOrders: vendorOrders.map((vo: any) => ({ vendorId: vo.vendorId })),
        };
      }
      return null;
    } catch (error) {
      Logger.error(`Failed to fetch order ${orderId} from Order Service`, error);
      return null;
    }
  }
}
