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
    actualQuantity?: number;
    requestedWeightGrams?: number;
    proposedWeightGrams?: number;
    requestedWeight?: number; // Computed for API (KG)
    proposedWeight?: number; // Computed for API (KG)
    status: ProposalStatus;
    createdAt: Date;
    updatedAt: Date;
    vendorName?: string; // Enriched for API
    productName?: string; // Enriched for API
    vendorId?: string; // Enriched for API
}
