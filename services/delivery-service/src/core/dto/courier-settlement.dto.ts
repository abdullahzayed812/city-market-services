export interface CreateCourierSettlementDto {
  courierId: string;
  periodStart: Date;
  periodEnd: Date;
  notes?: string;
}

export interface CourierPendingEarningsSummary {
  courierId: string;
  courierName?: string;
  courierType?: string;
  unsettledDeliveries: number;
  totalDeliveryFees: number;
  totalCashCollected: number;
  netPayout: number;
  oldestUnsettledDeliveryDate?: Date;
}

export interface DeliveryPlatformOverview {
  // Courier fees on delivered, unsettled deliveries
  totalPendingPayouts: number;
  pendingOfficeCourierPayouts: number;
  pendingFreelanceCourierPayouts: number;
  pendingOfficePayouts: number;
  // Cash couriers collected on delivered deliveries not yet settled
  pendingCashHeldByCouriers: number;
  totalSettledAmount: number;
  totalDeliveryFees: number;
  platformRevenue: number;
}
