import { VendorOrderItem } from "../entities/vendor-order-item.entity";

export interface IVendorOrderItemRepository {
    create(item: VendorOrderItem): Promise<VendorOrderItem>;
    findByVendorOrder(vendorOrderId: string): Promise<VendorOrderItem[]>;
    findById(id: string): Promise<VendorOrderItem | null>;
}
