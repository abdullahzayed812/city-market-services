import apiClient from "./client";
import { ApiResponse, ShopStatus } from "@city-market/shared";
import type { Vendor, UpdateVendorDto, WorkingHours, SetWorkingHoursDto } from "@city-market/shared";

// Merchant application; the same contract as the Vendor mobile app (vendor-service POST /register)
export interface StoreApplication {
  shopName: string;
  shopDescription?: string;
  ownerName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  ownerNationalIdUrl: string;
  commercialRegisterUrl: string;
  taxCardUrl?: string | null;
}


export const vendorService = {
  // Registration documents: media-service stores them under a random path in vendor-documents
  uploadDocument: async (file: File, onProgress?: (percent: number) => void): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "vendor-documents");
    const response = await apiClient.post<ApiResponse<{ url: string }>>("/media/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
    return response.data.data!.url;
  },
  registerStore: async (application: StoreApplication) => {
    const response = await apiClient.post<ApiResponse<Vendor>>("/vendors/register", application);
    return response.data?.data;
  },
  // Correct the application while it waits for review, or after a rejection
  resubmitStore: async (application: StoreApplication) => {
    const response = await apiClient.put<ApiResponse<Vendor>>("/vendors/me/registration", application);
    return response.data?.data;
  },
  getMyProfile: async () => {
    const response = await apiClient.get<ApiResponse<Vendor>>("/vendors/me");
    return response.data?.data;
  },
  updateProfile: async (id: string, data: UpdateVendorDto) => {
    const response = await apiClient.patch<ApiResponse<Vendor>>(`/vendors/${id}`, data);
    return response.data?.data;
  },
  updateStatus: async (id: string, status: ShopStatus) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/vendors/${id}/status`, { status });
    return response.data?.data;
  },
  setWorkingHours: async (id: string, workingHours: SetWorkingHoursDto[]) => {
    const response = await apiClient.post<ApiResponse<null>>(`/vendors/${id}/working-hours`, workingHours);
    return response.data?.data;
  },
  getWorkingHours: async (id: string) => {
    const response = await apiClient.get<ApiResponse<WorkingHours[]>>(`/vendors/${id}/working-hours`);
    return response.data?.data;
  },
  updateImage: async (id: string, imageUrl: string) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/vendors/${id}/image`, { imageUrl });
    return response.data?.data;
  },
};
