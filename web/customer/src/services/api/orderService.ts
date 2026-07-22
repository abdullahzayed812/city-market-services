import apiClient from './apiClient';
import type { CreateOrderDto, CustomerOrder, OrderWithItems } from '@/types';

export const OrderService = {
  createOrder: async (orderData: CreateOrderDto): Promise<OrderWithItems> => {
    const response = await apiClient.post('/orders', orderData);
    return response.data?.data;
  },
  getDeliveryFee: async (lat: number, lng: number, vendorIds: string[]): Promise<number> => {
    const response = await apiClient.get('/orders/delivery-fee', {
      params: { lat, lng, vendorIds: vendorIds.join(',') },
    });
    return response.data?.data?.deliveryFee;
  },
  getMyOrders: async (page: number, limit = 20): Promise<{ items: CustomerOrder[]; total: number }> => {
    const response = await apiClient.get('/orders/customer-orders', {
      params: { page, limit },
    });
    return response.data.data!;
  },
  getOrderById: async (id: string): Promise<OrderWithItems> => {
    const response = await apiClient.get(`/orders/customer-orders/${id}`);
    return response.data?.data;
  },
  getOrderProposals: async (id: string) => {
    const response = await apiClient.get(`/orders/customer-orders/${id}/proposals`);
    return response.data?.data;
  },
  acceptProposal: async (proposalId: string) => {
    const response = await apiClient.post(`/orders/proposals/${proposalId}/accept`);
    return response.data?.data;
  },
  rejectProposal: async (proposalId: string, cancelEntireOrder = false) => {
    const response = await apiClient.post(`/orders/proposals/${proposalId}/reject`, {
      cancelEntireOrder,
    });
    return response.data?.data;
  },
  resolveVendorCancellation: async (orderId: string, continueOrder: boolean) => {
    const response = await apiClient.post(`/orders/customer-orders/${orderId}/resolve-cancellation`, {
      continueOrder,
    });
    return response.data?.data;
  },
};
