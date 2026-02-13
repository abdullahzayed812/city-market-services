import { VendorOrderStatus } from "@city-market/shared";

export interface VendorOrder {
    id: string;
    customerOrderId: string;
    vendorId: string;
    status: VendorOrderStatus;
    subtotal: number;
    commissionAmount: number;
    totalAmount: number;
    deliveryId?: string;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
