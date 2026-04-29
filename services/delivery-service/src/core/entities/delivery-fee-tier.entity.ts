export interface DeliveryFeeTier {
  id: string;
  minAmount: number;
  maxAmount: number | null;
  courierPercentage: number;
  officePercentage: number;
  platformPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}
