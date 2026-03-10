import apiClient from "./client";
import { ApiResponse } from "@city-market/shared";
import type { VendorProduct, CreateVendorProductDto, UpdateVendorProductDto, Category } from "@city-market/shared";

export const productService = {
  getVendorProducts: async (vendorId: string) => {
    const response = await apiClient.get<ApiResponse<{ data: VendorProduct[] }>>(
      `/catalog/products/vendor/${vendorId}`,
    );
    return response.data?.data;
  },
  createVendorProduct: async (data: CreateVendorProductDto) => {
    const response = await apiClient.post<ApiResponse<VendorProduct>>("/catalog/products", data);
    return response.data?.data;
  },
  updateVendorProduct: async (id: string, data: UpdateVendorProductDto) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/catalog/products/${id}`, data);
    return response.data?.data;
  },
  updateVendorProductStock: async (id: string, stock?: number, weight?: number) => {
    const payload: any = {};
    if (stock !== undefined) payload.stock = stock;
    if (weight !== undefined) payload.weight = weight;
    const response = await apiClient.patch<ApiResponse<null>>(`/catalog/products/${id}/stock`, payload);
    return response.data?.data;
  },
  deleteVendorProduct: async (id: string) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/catalog/products/${id}`);
    return response.data?.data;
  },
  getGlobalCategories: async () => {
    const response = await apiClient.get<ApiResponse<Category[]>>("/catalog/categories/global");
    return response.data?.data;
  },
  getVendorCategories: async (vendorId: string) => {
    const response = await apiClient.get<ApiResponse<Category[]>>(`/catalog/categories/vendor/${vendorId}`);
    return response.data?.data;
  },
  uploadVendorProductImage: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await apiClient.post<ApiResponse<{ imageUrl: string }>>(
      `/catalog/products/${id}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data?.data;
  },
  getGlobalProducts: async (page: number, limit: number) => {
    const response = await apiClient.get<ApiResponse<{ data: any[]; total: number }>>("/catalog/global-products", {
      params: { page, limit },
    });
    return response.data?.data;
  },
};
