export enum ProposalType {
    QUANTITY_REDUCTION = "QUANTITY_REDUCTION",
    WEIGHT_ADJUSTMENT = "WEIGHT_ADJUSTMENT",
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
    proposedWeight?: number;
    requestedWeightGrams?: number;
    proposedWeightGrams?: number;
    status: ProposalStatus;
    createdAt: Date;
    updatedAt: Date;
}
