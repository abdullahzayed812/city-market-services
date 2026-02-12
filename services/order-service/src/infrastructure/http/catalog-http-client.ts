import axios from "axios";

export interface ProductInfo {
  id: string;
  vendorId: string;
  name: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
}

export class CatalogHttpClient {
  constructor(private baseUrl: string) { }

  async getProduct(productId: string, token?: string): Promise<ProductInfo | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/products/${productId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async checkAndDecrementStock(productId: string, quantity: number): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/products/${productId}/decrement-stock`, { quantity });
      return response.data.success;
    } catch (error) {
      return false;
    }
  }
}
