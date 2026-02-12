export enum ProposalType {
    QUANTITY_REDUCTION = "QUANTITY_REDUCTION",
    UNAVAILABLE = "UNAVAILABLE",
}

export enum ProposalStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
}

export interface OrderItemProposal {
    id: string;
    vendorOrderItemId: string;
    type: ProposalType;
    proposedQuantity?: number;
    status: ProposalStatus;
    createdAt: Date;
    updatedAt: Date;
}
