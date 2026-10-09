export type CourierType = "OFFICE" | "FREELANCE";
export type CourierApprovalStatus = "PENDING_REVIEW" | "APPROVED" | "SUSPENDED" | "REJECTED";

export interface Courier {
  id: string;
  userId: string;
  // Invariant (enforced in DeliveryService): FREELANCE <=> deliveryOfficeId is null
  deliveryOfficeId?: string | null;
  courierType: CourierType;
  approvalStatus: CourierApprovalStatus;
  nationalIdUrl?: string | null;
  licenseUrl?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastSeenAt?: Date | null;
  cancellationCount: number;
  fullName: string;
  phone: string;
  vehicleType?: string;
  licensePlate?: string;
  isAvailable: boolean;
  isActive: boolean;
  rating: number;
  ratingCount: number;
  totalDeliveries: number;
  createdAt: Date;
  updatedAt: Date;
}
