import { OrderItemProposal } from "../entities/order-item-proposal.entity";

export interface IOrderItemProposalRepository {
    create(proposal: OrderItemProposal): Promise<OrderItemProposal>;
    findById(id: string): Promise<OrderItemProposal | null>;
    findByVendorOrderItem(vendorOrderItemId: string): Promise<OrderItemProposal[]>;
    findByVendorOrder(vendorOrderId: string): Promise<OrderItemProposal[]>;
    updateStatus(id: string, status: string): Promise<void>;
}
