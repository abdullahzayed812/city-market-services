export interface VendorOrderItem {
    id: string;
    vendorOrderId: string;
    vendorProductId: string;
    productName: string;
    quantity?: number;
    requestedWeight?: number;
    actualWeight?: number;
    requestedWeightGrams?: number;
    actualWeightGrams?: number;
    unitPrice: number;
    totalPrice: number;
}
