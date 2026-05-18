import apiClient from './apiClient';
import type { Customer, Address, CreateAddressDto } from '@/types';

export const UserService = {
  createCustomer: async (dto: { fullName: string; phone?: string }): Promise<Customer> => {
    const response = await apiClient.post('/users/customers', dto);
    return response.data?.data;
  },
  getProfile: async (): Promise<Customer> => {
    const response = await apiClient.get('/users/customers/me');
    return response.data?.data;
  },
  updateProfile: async (profileData: Partial<Customer>) => {
    const response = await apiClient.patch('/users/customers/me', profileData);
    return response.data?.data;
  },
  getAddresses: async (): Promise<Address[]> => {
    const response = await apiClient.get('/users/customers/me/addresses');
    return response.data?.data;
  },
  addAddress: async (addressData: CreateAddressDto): Promise<Address> => {
    const response = await apiClient.post('/users/customers/me/addresses', addressData);
    return response.data?.data;
  },
  deleteAddress: async (addressId: string) => {
    const response = await apiClient.delete(`/users/addresses/${addressId}`);
    return response.data?.data;
  },
};
