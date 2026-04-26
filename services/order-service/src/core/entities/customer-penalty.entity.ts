export interface CustomerPenalty {
  id: string;
  customerId: string;
  customerOrderId: string;
  deliveryId?: string;
  reason: string;
  isActive: boolean;
  createdAt: Date;
}
