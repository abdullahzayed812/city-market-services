export interface CommissionTier {
    id: string;
    vendorId?: string | null;
    vendorType?: string | null;
    minAmount: number;
    maxAmount: number | null; // null means no upper limit
    percentage: number;
    createdAt?: Date;
    updatedAt?: Date;
}
