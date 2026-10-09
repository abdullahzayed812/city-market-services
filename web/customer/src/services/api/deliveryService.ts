import apiClient from './apiClient';

export interface OrderCourier {
  deliveryId: string;
  status: 'PENDING' | 'ACCEPTED' | 'ASSIGNED' | 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | 'FAILED';
  fulfillmentType: 'OFFICE' | 'FREELANCE' | null;
  pickupCount: number;
  // Set from assignment on; phone is empty once delivered
  courier: { name: string; phone: string; vehicleType: string | null; licensePlate: string | null } | null;
  // Office that handled it; null for a freelance courier
  officeName: string | null;
  myRating: { stars: number; comment: string | null } | null;
  canRate: boolean;
}

export const DeliveryService = {
  getOrderCouriers: async (orderId: string): Promise<OrderCourier[]> => {
    const response = await apiClient.get(`/delivery/deliveries/by-order/${orderId}/couriers`);
    return response.data?.data ?? [];
  },
  rateDelivery: async (deliveryId: string, stars: number, comment?: string): Promise<void> => {
    await apiClient.post(`/delivery/deliveries/${deliveryId}/rating`, { stars, comment });
  },
};
