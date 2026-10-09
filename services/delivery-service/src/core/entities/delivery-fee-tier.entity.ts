export interface DeliveryFeeTier {
  id: string;
  minAmount: number;
  maxAmount: number | null;
  courierPercentage: number;
  officePercentage: number;
  platformPercentage: number;
  // Both null => freelancer gets courierPercentage + officePercentage
  freelanceCourierPercentage: number | null;
  freelancePlatformPercentage: number | null;
  createdAt: Date;
  updatedAt: Date;
}
