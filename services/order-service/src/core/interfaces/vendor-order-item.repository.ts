import { VendorOrderItem } from "../entities/vendor-order-item.entity";

export interface IVendorOrderItemRepository {
    create(item: VendorOrderItem, connection?: any): Promise<VendorOrderItem>;
    findByVendorOrder(vendorOrderId: string, connection?: any): Promise<VendorOrderItem[]>;
    findById(id: string, connection?: any): Promise<VendorOrderItem | null>;
    findByIdWithLock(id: string, connection: any): Promise<VendorOrderItem | null>;
    update(id: string, data: Partial<VendorOrderItem>, connection?: any): Promise<void>;
}
