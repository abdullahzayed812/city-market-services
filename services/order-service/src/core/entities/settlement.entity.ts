export enum SettlementStatus {
    PENDING = 'PENDING',
    PAID = 'PAID'
}

export interface Settlement {
    id: string;
    vendorId: string;
    status: SettlementStatus;
    periodStart: Date;
    periodEnd: Date;
    totalVendorRevenue: number;
    totalCommission: number;
    netPayout: number;
    orderCount: number;
    notes?: string;
    createdAt: Date;
    settledAt?: Date;
}
