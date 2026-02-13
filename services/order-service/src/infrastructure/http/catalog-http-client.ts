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
  constructor(private baseUrl: string) {}

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

  async checkAndDecrementStock(productId: string, quantity: number, token?: string): Promise<void> {
    try {
      // Assuming the catalog service's endpoint for decrement-stock performs the safe update pattern:
      // UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?
      // And returns success only if affectedRows === 1.
      const response = await axios.patch(
        `${this.baseUrl}/products/${productId}/stock`,
        { stock: quantity },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!response.data?.success) {
        // If the catalog service indicates failure (e.g., insufficient stock), throw an error
        throw new Error(
          `Failed to decrement stock for product ${productId}: ${response.data.message || "Unknown reason"}`
        );
      }
      // If success is true, no need to return anything, just complete
    } catch (error: any) {
      // Re-throw any error so the calling service can catch and rollback
      throw new Error(`Catalog service stock decrement failed for product ${productId}: ${error.message}`);
    }
  }
}
