import { VendorOrderStatus } from "@city-market/shared";

export interface VendorOrder {
    id: string;
    customerOrderId: string;
    vendorId: string;
    status: VendorOrderStatus;
    subtotal: number;
    commissionAmount: number;
    commissionPercentage?: number;
    totalAmount: number;
    deliveryId?: string;
    settlementId?: string;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
