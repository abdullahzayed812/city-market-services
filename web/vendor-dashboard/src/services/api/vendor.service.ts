import apiClient from "./client";
import { ApiResponse, ShopStatus } from "@city-market/shared";
import type { Vendor, UpdateVendorDto, WorkingHours, SetWorkingHoursDto } from "@city-market/shared";


export const vendorService = {
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
  uploadImage: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await apiClient.post<ApiResponse<{ imageUrl: string }>>(`/vendors/${id}/image`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data?.data;
  },
};
