import apiClient from './apiClient';

export const RatingService = {
  getSummary: async (vendorId: string) => {
    const response = await apiClient.get(`/ratings/vendors/${vendorId}/rating`);
    return response.data;
  },
  getReviews: async (vendorId: string, limit = 10, offset = 0) => {
    const response = await apiClient.get(`/ratings/vendors/${vendorId}`, {
      params: { limit, offset },
    });
    return response.data;
  },
  rateVendor: async (orderId: string, vendorId: string, stars: number, comment?: string) => {
    const response = await apiClient.post('/ratings', { orderId, vendorId, stars, comment });
    return response.data;
  },
};
