import { CustomerOrderStatus } from "@city-market/shared";

export interface CustomerOrder {
  id: string;
  customerId: string;
  status: CustomerOrderStatus;
  subtotal: number;
  deliveryFee: number;
  commissionAmount: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  customerNotes?: string;
  cancellationReason?: string;
  customerDecisionDeadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}
