import apiClient from "./client";
import { ApiResponse } from "@city-market/shared";
import type { Courier, Delivery, AssignCourierDto } from "@city-market/shared";

export const deliveryService = {
  // Couriers Management
  getAllCouriers: async () => {
    const response = await apiClient.get<ApiResponse<Courier[]>>("/delivery/couriers");
    return response.data?.data;
  },

  getAvailableCouriers: async () => {
    const response = await apiClient.get<ApiResponse<Courier[]>>("/delivery/couriers/available");
    return response.data?.data;
  },

  // Deliveries Management
  getAllDeliveries: async () => {
    const response = await apiClient.get<ApiResponse<{ items: Delivery[]; hasNextPage: boolean }>>("/delivery/deliveries");
    return response.data?.data;
  },

  getPendingDeliveries: async () => {
    const response = await apiClient.get<ApiResponse<Delivery[]>>("/delivery/deliveries/pending");
    return response.data?.data;
  },

  getDeliveryDetails: async (id: string) => {
    const response = await apiClient.get<ApiResponse<Delivery>>(`/delivery/deliveries/${id}`);
    return response.data?.data;
  },

  acceptDelivery: async (deliveryId: string) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/delivery/deliveries/${deliveryId}/accept`, {});
    return response.data?.data;
  },

  assignCourier: async (deliveryId: string, body: AssignCourierDto) => {
    const response = await apiClient.post<ApiResponse<null>>(`/delivery/deliveries/${deliveryId}/assign`, body);
    return response.data?.data;
  },

  // Office Settlements
  getOfficePendingEarnings: async () => {
    const response = await apiClient.get<ApiResponse<any>>("/delivery/office-settlements/pending");
    return response.data?.data;
  },

  getOfficeSettlements: async (limit = 10, offset = 0) => {
    const response = await apiClient.get<ApiResponse<any[]>>(`/delivery/office-settlements?limit=${limit}&offset=${offset}`);
    return response.data?.data;
  },

  createOfficeSettlement: async (body: { periodStart: string; periodEnd: string; notes?: string }) => {
    const response = await apiClient.post<ApiResponse<any>>("/delivery/office-settlements", body);
    return response.data?.data;
  },

  markOfficeSettlementPaid: async (id: string) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/delivery/office-settlements/${id}/mark-paid`, {});
    return response.data?.data;
  },

  // Courier Settlements
  getAllCouriersPendingEarnings: async () => {
    const response = await apiClient.get<ApiResponse<any[]>>("/delivery/courier-settlements/all-pending");
    return response.data?.data;
  },

  getCourierSettlements: async (courierId?: string, limit = 10, offset = 0) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (courierId) params.set("courierId", courierId);
    const response = await apiClient.get<ApiResponse<any[]>>(`/delivery/courier-settlements?${params}`);
    return response.data?.data;
  },

  createCourierSettlement: async (body: { courierId: string; periodStart: string; periodEnd: string; notes?: string }) => {
    const response = await apiClient.post<ApiResponse<any>>("/delivery/courier-settlements", body);
    return response.data?.data;
  },

  markCourierSettlementPaid: async (id: string) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/delivery/courier-settlements/${id}/mark-paid`, {});
    return response.data?.data;
  },

  getCourierPendingEarnings: async (courierId: string) => {
    const response = await apiClient.get<ApiResponse<any>>(`/delivery/courier-settlements/courier/${courierId}/pending`);
    return response.data?.data;
  },
};
