import apiClient from "./client";
import { ApiResponse } from "@city-market/shared";
import type { Product, CreateProductDto, UpdateProductDto, Category } from "@city-market/shared";

export const productService = {
  getVendorProducts: async (vendorId: string) => {
    const response = await apiClient.get<ApiResponse<{ products: Product[] }>>(`/catalog/products/vendor/${vendorId}`);
    return response.data?.data;
  },
  createProduct: async (data: CreateProductDto) => {
    const response = await apiClient.post<ApiResponse<Product>>("/catalog/products", data);
    return response.data?.data;
  },
  updateProduct: async (id: string, data: UpdateProductDto) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/catalog/products/${id}`, data);
    return response.data?.data;
  },
  updateStock: async (id: string, stock: number) => {
    const response = await apiClient.patch<ApiResponse<null>>(`/catalog/products/${id}/stock`, { stock });
    return response.data?.data;
  },
  deleteProduct: async (id: string) => {
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
  uploadImage: async (id: string, file: File) => {
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
};
