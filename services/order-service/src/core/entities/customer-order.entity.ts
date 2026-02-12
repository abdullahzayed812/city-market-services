import { OrderStatus } from "@city-market/shared";

export interface CustomerOrder {
    id: string;
    customerId: string;
    status: OrderStatus;
    subtotal: number;
    deliveryFee: number;
    commissionAmount: number;
    totalAmount: number;
    deliveryAddress: string;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    customerNotes?: string;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
