import { ShopStatus } from "../enums/shop-status";
import { VendorApprovalStatus } from "../enums/vendor-approval-status.enum";

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
  commissionRate: number;
  isActive: boolean;
  // Kept up to date by vendor-service from rating-service (VENDOR_RATING_UPDATED)
  averageRating?: number;
  totalRatings?: number;
  // Merchant onboarding (see VendorApprovalStatus)
  approvalStatus?: VendorApprovalStatus;
  ownerName?: string | null;
  ownerNationalIdUrl?: string | null;
  commercialRegisterUrl?: string | null;
  taxCardUrl?: string | null;
  // Admin's reason for the last rejection / suspension, shown to the merchant
  reviewNote?: string | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkingHours {
  id: string;
  vendorId: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface CreateVendorDto {
  userId: string;
  shopName: string;
  shopDescription?: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  type?: string;
}

export interface UpdateVendorDto {
  shopName?: string;
  shopDescription?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
}

export interface UpdateStatusDto {
  status: ShopStatus;
}

export interface SetWorkingHoursDto {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}
