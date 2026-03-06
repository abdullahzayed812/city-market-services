import { VendorRatingSummary } from "../entities/Rating";
import { PoolConnection } from "mysql2/promise";

export interface IVendorRatingSummaryRepository {
    findByVendorId(vendorId: string, connection?: PoolConnection): Promise<VendorRatingSummary | null>;
    create(summary: VendorRatingSummary, connection?: PoolConnection): Promise<void>;
    update(summary: VendorRatingSummary, connection?: PoolConnection): Promise<void>;
    findByVendorIdWithLock(vendorId: string, connection: PoolConnection): Promise<VendorRatingSummary | null>;
}
