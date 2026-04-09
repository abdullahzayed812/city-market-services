export interface CreateSettlementDto {
    vendorId: string;
    periodStart: Date;
    periodEnd: Date;
    notes?: string;
}

export interface PendingEarningsSummary {
    vendorId: string;
    unsettledOrders: number;
    totalRevenue: number;
    totalCommission: number;
    netPayout: number;
    oldestUnsettledOrderDate?: Date;
}

export interface PlatformFinancialOverview {
    totalPendingPayouts: number;
    totalSettledAmount: number;
    platformCommissionEarned: number;
}
