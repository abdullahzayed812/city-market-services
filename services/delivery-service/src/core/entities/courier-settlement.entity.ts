export enum CourierSettlementStatus {
  PENDING = "PENDING",
  PAID = "PAID",
}

export interface CourierSettlement {
  id: string;
  courierId: string;
  status: CourierSettlementStatus;
  periodStart: Date;
  periodEnd: Date;
  totalDeliveryFees: number;
  netPayout: number;
  deliveryCount: number;
  notes?: string;
  createdAt: Date;
  settledAt?: Date;
}
