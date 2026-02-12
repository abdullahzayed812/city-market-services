import { OrderStatus } from "@city-market/shared";

export interface VendorOrder {
    id: string;
    customerOrderId: string;
    vendorId: string;
    status: OrderStatus;
    subtotal: number;
    commissionAmount: number;
    totalAmount: number;
    deliveryId?: string;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
