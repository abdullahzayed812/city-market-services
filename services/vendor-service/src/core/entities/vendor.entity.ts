import { ShopStatus, VendorApprovalStatus } from "@city-market/shared";

export interface Vendor {
  id: string;
  userId: string;
  shopName: string;
  shopDescription?: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  storeImage?: string;
  type?: string;
  status: ShopStatus;
  averageRating: number;
  totalRatings: number;
  isActive: boolean;
  approvalStatus: VendorApprovalStatus;
  ownerName?: string | null;
  ownerNationalIdUrl?: string | null;
  commercialRegisterUrl?: string | null;
  taxCardUrl?: string | null;
  reviewNote?: string | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorApprovalHistoryEntry {
  id: string;
  vendorId: string;
  approvalStatus: VendorApprovalStatus;
  note: string | null;
  actorUserId: string | null;
  createdAt: Date;
}
