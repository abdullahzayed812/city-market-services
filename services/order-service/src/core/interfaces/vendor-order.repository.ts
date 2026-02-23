import { VendorOrder } from "../entities/vendor-order.entity";
import { VendorOrderWithItemsDto } from "@city-market/shared";

export interface IVendorOrderRepository {
    create(order: VendorOrder, connection?: any): Promise<VendorOrder>;
    findById(id: string, connection?: any): Promise<VendorOrder | null>;
    findByIdWithLock(id: string, connection: any): Promise<VendorOrder | null>;
    findByCustomerOrder(customerOrderId: string, connection?: any): Promise<VendorOrder[]>;
    findByVendor(vendorId: string, limit: number, offset: number, connection?: any): Promise<VendorOrder[]>;
    findByVendorWithItems(vendorId: string, limit: number, offset: number, connection?: any): Promise<VendorOrderWithItemsDto[]>;
    findByStatus(status: string, connection?: any): Promise<VendorOrder[]>;
    updateStatus(id: string, status: string, connection?: any): Promise<void>;
    update(id: string, data: Partial<VendorOrder>, connection?: any): Promise<void>;
}
