import axios from "axios";
import { Logger } from "@city-market/shared/node";

export interface VendorInfo {
    id: string;
    userId: string;
    businessName: string;
    address: string;
    status: string;
    latitude: number;
    longitude: number;
}

export class VendorHttpClient {
    constructor(private baseUrl: string) { }

    async getVendor(vendorId: string, token?: string): Promise<VendorInfo | null> {
        try {
            const response = await axios.get(`${this.baseUrl}/${vendorId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (response.data.success && response.data.data) {
                return response.data.data;
            }
            return null;
        } catch (error) {
            Logger.error(`Failed to fetch vendor ${vendorId}`, error);
            return null;
        }
    }
}
