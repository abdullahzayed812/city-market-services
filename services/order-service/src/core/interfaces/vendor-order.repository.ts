import { VendorOrder } from "../entities/vendor-order.entity";

export interface IVendorOrderRepository {
    create(order: VendorOrder): Promise<VendorOrder>;
    findById(id: string): Promise<VendorOrder | null>;
    findByCustomerOrder(customerOrderId: string): Promise<VendorOrder[]>;
    findByVendor(vendorId: string, limit: number, offset: number): Promise<VendorOrder[]>;
    findByStatus(status: string): Promise<VendorOrder[]>;
    updateStatus(id: string, status: string): Promise<void>;
    update(id: string, data: Partial<VendorOrder>): Promise<void>;
}
