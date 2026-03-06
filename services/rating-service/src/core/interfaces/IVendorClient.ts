export interface VendorInfo {
    id: string;
    userId: string;
    shopName: string;
}

export interface IVendorClient {
    getVendor(vendorId: string, userId?: string): Promise<VendorInfo | null>;
}
