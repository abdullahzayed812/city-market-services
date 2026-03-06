import { Rating } from "../entities/Rating";
import { PoolConnection } from "mysql2/promise";

export interface IRatingRepository {
    create(rating: Rating, connection?: PoolConnection): Promise<Rating>;
    findByOrderId(orderId: string): Promise<Rating | null>;
    findByOrderAndVendor(orderId: string, vendorId: string): Promise<Rating | null>;
    findByVendorId(vendorId: string, limit: number, offset: number): Promise<Rating[]>;
}
