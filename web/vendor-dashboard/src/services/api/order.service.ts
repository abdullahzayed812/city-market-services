import apiClient from "./client";
import { ApiResponse, VendorOrderStatus } from "@city-market/shared";
import type {
  VendorOrder,
  VendorOrderItem,
  ProposeChangesDto,
  OrderItemProposal,
  VendorOrderWithItemsDto,
} from "@city-market/shared";

export const orderService = {
  getVendorOrders: async (vendorId: string) => {
    const response = await apiClient.get<ApiResponse<VendorOrderWithItemsDto[]>>(`/orders/vendor/${vendorId}`);
    return response.data?.data;
  },
  getOrderById: async (id: string) => {
    const response = await apiClient.get<
      ApiResponse<VendorOrder & { items: VendorOrderItem[]; vendorName: string; proposals: OrderItemProposal[] }>
    >(`/orders/vendor-orders/${id}`);
    return response.data?.data;
  },
  acceptOrder: async (id: string) => {
    const response = await apiClient.post<ApiResponse<null>>(`/orders/vendor-orders/${id}/accept`);
    return response.data?.data;
  },
  proposeChanges: async (id: string, proposals: ProposeChangesDto[]) => {
    const response = await apiClient.post<ApiResponse<null>>(`/orders/vendor-orders/${id}/propose`, { proposals });
    return response.data?.data;
  },
  updateOrderStatus: async (
    id: string,
    status: VendorOrderStatus,
    itemWeights?: { itemId: string; actualWeight?: number; actualWeightGrams?: number }[],
    notes?: string,
  ) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/orders/vendor-orders/${id}/status`, {
      status,
      notes,
      itemWeights,
    });
    return response.data?.data;
  },
  cancelOrder: async (id: string) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/orders/vendor-orders/${id}/status`, {
      status: VendorOrderStatus.CANCELLED,
    });
    return response.data?.data;
  },
  getPendingEarnings: async (vendorId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await apiClient.get<ApiResponse<any>>(`/orders/settlements/vendor/${vendorId}/pending`);
    return response.data?.data;
  },
  getSettlements: async (vendorId: string, page: number = 1, limit: number = 20) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await apiClient.get<ApiResponse<any>>(`/orders/settlements`, {
      params: { vendorId, page, limit },
    });
    return response.data?.data;
  },
};
