import apiClient from "./client";

export const orderService = {
  getVendorOrders: async (vendorId: string) => {
    const response = await apiClient.get(`/orders/vendor/${vendorId}`);
    return response.data?.data;
  },
  getOrderById: async (id: string) => {
    const response = await apiClient.get(`/orders/vendor-orders/${id}`);
    return response.data?.data;
  },
  acceptOrder: async (id: string) => {
    const response = await apiClient.post(`/orders/vendor-orders/${id}/accept`);
    return response.data?.data;
  },
  proposeChanges: async (id: string, proposal: { itemId: string; type: string; proposedQuantity?: number }) => {
    const response = await apiClient.post(`/orders/vendor-orders/${id}/propose`, proposal);
    return response.data?.data;
  },
  updateOrderStatus: async (id: string, status: string, notes?: string) => {
    const response = await apiClient.patch(`/orders/vendor-orders/${id}/status`, { status, notes });
    return response.data?.data;
  },
  cancelOrder: async (id: string) => {
    const response = await apiClient.patch(`/orders/vendor-orders/${id}/status`, { status: "CANCELLED" });
    return response.data?.data;
  },
};
