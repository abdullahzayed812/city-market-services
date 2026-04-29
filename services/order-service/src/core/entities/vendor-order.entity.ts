import { VendorOrderStatus } from "@city-market/shared";

export interface VendorOrder {
    id: string;
    customerOrderId: string;
    vendorId: string;
    vendorUserId?: string;
    status: VendorOrderStatus;
    subtotal: number;
    commissionAmount: number;
    commissionPercentage?: number;
    totalAmount: number;
    deliveryId?: string;
    settlementId?: string;
    cancellationReason?: string;
    confirmationExpiry?: Date;
    createdAt: Date;
    updatedAt: Date;
}
