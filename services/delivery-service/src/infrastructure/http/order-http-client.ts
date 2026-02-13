import axios from 'axios';
import { CustomerOrderStatus, VendorOrderStatus } from '@city-market/shared';

export class OrderHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getOrder(orderId: string, token?: string): Promise<any> { // Assuming 'any' for now, can be refined later with a DTO
    try {
      const response = await axios.get(`${this.baseUrl}/customer-orders/${orderId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch customer order ${orderId}:`, error.message);
      throw error;
    }
  }

  async updateCustomerOrderStatus(orderId: string, status: CustomerOrderStatus, token?: string): Promise<void> {
    try {
      await axios.patch(`${this.baseUrl}/customer-orders/${orderId}/status`, { status }, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
    } catch (error: any) {
      console.error(`Failed to update customer order status for ${orderId}:`, error.message);
      throw error;
    }
  }

  async updateVendorOrderStatus(vendorOrderId: string, status: VendorOrderStatus, token?: string): Promise<void> {
    try {
      await axios.patch(`${this.baseUrl}/vendor-orders/${vendorOrderId}/status`, { status }, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
    } catch (error: any) {
      console.error(`Failed to update vendor order status for ${vendorOrderId}:`, error.message);
      throw error;
    }
  }
}
