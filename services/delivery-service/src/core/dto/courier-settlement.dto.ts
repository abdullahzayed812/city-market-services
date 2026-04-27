export interface CreateCourierSettlementDto {
  courierId: string;
  periodStart: Date;
  periodEnd: Date;
  notes?: string;
}

export interface CourierPendingEarningsSummary {
  courierId: string;
  courierName?: string;
  unsettledDeliveries: number;
  totalDeliveryFees: number;
  netPayout: number;
  oldestUnsettledDeliveryDate?: Date;
}

export interface DeliveryPlatformOverview {
  totalPendingPayouts: number;
  totalSettledAmount: number;
  totalDeliveryFees: number;
}
