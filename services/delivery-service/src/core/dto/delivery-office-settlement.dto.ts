export interface CreateOfficeSettlementDto {
  deliveryOfficeId?: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

export interface OfficePendingEarningsSummary {
  unsettledDeliveries: number;
  totalDeliveryFees: number;
  netPayout: number;
  oldestUnsettledDeliveryDate?: Date;
}
