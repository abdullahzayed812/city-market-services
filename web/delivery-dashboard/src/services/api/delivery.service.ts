import apiClient from "./client";
import { ApiResponse, type Courier, type Delivery, type AssignCourierDto } from "@city-market/shared";

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
    const response = await apiClient.get<ApiResponse<Delivery[]>>("/delivery/deliveries");
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

  assignCourier: async (deliveryId: string, body: AssignCourierDto) => {
    const response = await apiClient.post<ApiResponse<null>>(`/delivery/deliveries/${deliveryId}/assign`, body);
    return response.data?.data;
  },

  // updateDeliveryStatus: async (id: string, status: string) => {
  //   const response = await apiClient.patch(`/delivery/deliveries/${id}/status`, { status });
  //   return response.data?.data;
  // },
};
