import apiClient from "./client";

export const ratingService = {
    getVendorRatingSummary: async (vendorId: string) => {
        const response = await apiClient.get(`/ratings/vendors/${vendorId}/rating`);
        return response.data;
    },
    getVendorReviews: async (vendorId: string, limit = 10, offset = 0) => {
        const response = await apiClient.get(`/ratings/vendors/${vendorId}`, {
            params: { limit, offset }
        });
        return response.data;
    }
};
