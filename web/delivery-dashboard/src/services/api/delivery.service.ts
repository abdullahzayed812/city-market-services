import apiClient from "./client";
import { ApiResponse } from "@city-market/shared";
import type { Courier, Delivery, AssignCourierDto } from "@city-market/shared";

export interface DeliveryRatingItem {
  id: string;
  customerOrderId: string;
  courierId: string;
  courierName: string | null;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface DeliveryRatingsResult {
  summary: { averageRating: number | null; totalRatings: number; distribution: Record<string, number> };
  items: DeliveryRatingItem[];
  hasNextPage: boolean;
}

export interface MyOffice {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  approvalStatus: "PENDING_REVIEW" | "APPROVED" | "SUSPENDED";
  isActive: boolean;
}

export interface AddOfficeCourierDto {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  vehicleType: string;
  licensePlate?: string;
  nationalIdUrl: string;
  licenseUrl?: string;
}

// media-service picks the storage path inside the folder
const uploadDocument = async (file: File, folder: "office-documents" | "courier-documents"): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const response = await apiClient.post<{ data: { url: string } }>("/media/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data.url;
};

export const deliveryService = {
  // The signed-in manager's office; 404 until they register one
  getMyOffice: async () => {
    const response = await apiClient.get<ApiResponse<MyOffice>>("/delivery/delivery-offices/me");
    return response.data?.data;
  },

  registerOffice: async (dto: { name: string; phone: string; address: string; ownerNationalIdUrl: string; commercialRegisterUrl: string }) => {
    const response = await apiClient.post<ApiResponse<MyOffice>>("/delivery/delivery-offices/register", dto);
    return response.data?.data;
  },

  // Office signup document; media-service picks the storage path
  uploadOfficeDocument: (file: File) => uploadDocument(file, "office-documents"),

  // Identity documents of a courier the manager is adding to the office
  uploadCourierDocument: (file: File) => uploadDocument(file, "courier-documents"),

  // New office courier: creates the login and sends the courier to admin review
  addOfficeCourier: async (dto: AddOfficeCourierDto) => {
    const response = await apiClient.post<ApiResponse<Courier>>("/delivery/couriers/office/register", dto);
    return response.data?.data;
  },


  // Customer ratings of this office's deliveries (optionally one courier)
  getDeliveryRatings: async (params?: { courierId?: string; page?: number; limit?: number }) => {
    const response = await apiClient.get<ApiResponse<DeliveryRatingsResult>>("/delivery/delivery-ratings", { params });
    return response.data?.data;
  },

  // Couriers Management
  getAllCouriers: async () => {
    const response = await apiClient.get<ApiResponse<Courier[]>>("/delivery/couriers", { params: { limit: 100 } });
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
