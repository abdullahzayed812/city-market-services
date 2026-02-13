import { OrderItemProposal } from "../entities/order-item-proposal.entity";

export interface IOrderItemProposalRepository {
    create(proposal: OrderItemProposal, connection?: any): Promise<OrderItemProposal>;
    findById(id: string, connection?: any): Promise<OrderItemProposal | null>;
    findByVendorOrderItem(vendorOrderItemId: string, connection?: any): Promise<OrderItemProposal[]>;
    findByVendorOrder(vendorOrderId: string, connection?: any): Promise<OrderItemProposal[]>;
    updateStatus(id: string, status: string, connection?: any): Promise<void>;
}
