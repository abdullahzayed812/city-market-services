import apiClient from "./client";
import { ApiResponse } from "@city-market/shared";
import type {
  VendorProduct,
  UpdateVendorProductDto,
  Category,
  BulkAddVendorProductsFromGlobalItem,
  BulkAddVendorProductsFromGlobalResult,
} from "@city-market/shared";

export const productService = {
  getVendorProducts: async (vendorId: string, page: number = 1, limit: number = 20) => {
    const response = await apiClient.get<ApiResponse<{ data: VendorProduct[]; total: number; page: number; limit: number }>>(
      `/catalog/products/vendor/${vendorId}`,
      { params: { page, limit } },
    );
    return response.data?.data;
  },
  updateVendorProduct: async (id: string, data: UpdateVendorProductDto) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/catalog/products/${id}`, data);
    return response.data?.data;
  },
  updateVendorProductStock: async (id: string, stock?: number, weight?: number) => {
    const payload: any = {};
    if (stock) payload.stock = stock;
    if (weight) payload.weight = weight;
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
  updateProductImage: async (id: string, imageUrl: string) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/catalog/products/${id}/image`, { imageUrl });
    return response.data?.data;
  },
  getGlobalProducts: async (page: number, limit: number, search?: string) => {
    const response = await apiClient.get<ApiResponse<{ data: any[]; total: number }>>("/catalog/global-products", {
      params: { page, limit, search },
    });
    return response.data?.data;
  },
  bulkAddProductsFromGlobal: async (vendorId: string, items: BulkAddVendorProductsFromGlobalItem[]) => {
    const response = await apiClient.post<ApiResponse<BulkAddVendorProductsFromGlobalResult>>(
      `/catalog/products/vendor/${vendorId}/bulk-add-global`,
      { items },
    );
    return response.data?.data;
  },
};
