import { BaseClient } from "./BaseClient";

export class RatingClient extends BaseClient {
  // Reviews for one vendor (rating-service), newest first
  async getVendorRatings(vendorId: string, limit = 20, offset = 0, userId?: string) {
    const config = await this.getRequestConfig(userId);
    const response = await this.axiosInstance.get(`/vendors/${vendorId}`, { params: { limit, offset }, ...config });
    return response.data;
  }
}
