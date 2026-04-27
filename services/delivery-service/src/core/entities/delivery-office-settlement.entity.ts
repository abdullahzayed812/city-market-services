export enum OfficeSettlementStatus {
  PENDING = "PENDING",
  PAID = "PAID",
}

export interface DeliveryOfficeSettlement {
  id: string;
  deliveryOfficeId?: string;
  status: OfficeSettlementStatus;
  periodStart: Date;
  periodEnd: Date;
  totalDeliveryFees: number;
  netPayout: number;
  deliveryCount: number;
  notes?: string;
  createdAt: Date;
  settledAt?: Date;
}
