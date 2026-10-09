export type OfficeApprovalStatus = "PENDING_REVIEW" | "APPROVED" | "SUSPENDED";

export interface DeliveryOffice {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  approvalStatus: OfficeApprovalStatus;
  ownerNationalIdUrl?: string | null;
  commercialRegisterUrl?: string | null;
  rating: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}
