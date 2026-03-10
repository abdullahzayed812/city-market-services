export interface VendorOrderItem {
    id: string;
    vendorOrderId: string;
    vendorProductId: string;
    productName: string;
    quantity?: number;
    requestedWeightGrams?: number;
    actualWeightGrams?: number;
    requestedWeight?: number; // Computed for API (KG)
    actualWeight?: number; // Computed for API (KG)
    unitPrice: number;
    totalPrice: number;
}
