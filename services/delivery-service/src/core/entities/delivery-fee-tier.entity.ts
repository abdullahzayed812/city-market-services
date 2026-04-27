export interface DeliveryFeeTier {
  id: string;
  minAmount: number;
  maxAmount: number | null;
  courierPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}
