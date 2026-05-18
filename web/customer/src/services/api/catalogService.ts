import apiClient from './apiClient';
import type { Category, VendorProduct, VendorProductFilter, PaginatedResult } from '@/types';

export const CatalogService = {
  getCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get('/catalog/categories');
    return response.data?.data;
  },
  getGlobalCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get('/catalog/categories/global');
    return response.data?.data;
  },
  getVendorCategories: async (vendorId: string): Promise<Category[]> => {
    const response = await apiClient.get(`/catalog/categories/vendor/${vendorId}`);
    return response.data?.data;
  },
  getVendorProducts: async (filter?: VendorProductFilter): Promise<VendorProduct[]> => {
    const response = await apiClient.get('/catalog/products/search', { params: filter });
    return response.data?.data;
  },
  getVendorProductsByCategory: async (categoryId: string): Promise<VendorProduct[]> => {
    const response = await apiClient.get(`/catalog/products/category/${categoryId}`);
    return response.data?.data;
  },
  getVendorProductsByVendor: async (
    vendorId: string,
    page = 1,
    limit = 20,
    vendorCategoryId?: string,
  ): Promise<PaginatedResult<VendorProduct>> => {
    const response = await apiClient.get(`/catalog/products/vendor/${vendorId}`, {
      params: { page, limit, ...(vendorCategoryId ? { vendorCategoryId } : {}) },
    });
    return response.data?.data;
  },
  getVendorProductById: async (id: string): Promise<VendorProduct> => {
    const response = await apiClient.get(`/catalog/products/${id}`);
    return response.data?.data;
  },
  searchVendorProducts: async (
    filter: VendorProductFilter & { page?: number; limit?: number },
  ): Promise<PaginatedResult<VendorProduct>> => {
    const response = await apiClient.get('/catalog/products/search', { params: filter });
    return response.data?.data;
  },
};
