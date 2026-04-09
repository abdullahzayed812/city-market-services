export interface CommissionTier {
    id: string;
    minAmount: number;
    maxAmount: number | null; // null means no upper limit
    percentage: number;
    createdAt?: Date;
    updatedAt?: Date;
}
