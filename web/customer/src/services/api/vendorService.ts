import apiClient from './apiClient';
import type { Vendor } from '@/types';

export const VendorService = {
  getVendors: async (): Promise<Vendor[]> => {
    const response = await apiClient.get('/vendors');
    return response.data?.data;
  },
  getOpenVendors: async (): Promise<Vendor[]> => {
    const response = await apiClient.get('/vendors/open');
    return response.data?.data;
  },
  getVendorById: async (id: string): Promise<Vendor> => {
    const response = await apiClient.get(`/vendors/${id}`);
    return response.data?.data;
  },
  getVendorsByIds: async (ids: string[]): Promise<Vendor[]> => {
    const response = await apiClient.post('/vendors/bulk', { ids });
    return response.data?.data;
  },
};
