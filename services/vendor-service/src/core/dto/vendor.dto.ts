import { ShopStatus, VendorApprovalStatus } from "@city-market/shared";

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

// Merchant self-registration (and resubmission after a rejection). The user id always
// comes from the token, never from the body.
export interface RegisterVendorDto {
  shopName?: string;
  shopDescription?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
  ownerNationalIdUrl?: string;
  commercialRegisterUrl?: string;
  taxCardUrl?: string | null;
}

export interface SetVendorApprovalDto {
  status: VendorApprovalStatus;
  // Required when rejecting or suspending; shown to the merchant
  note?: string;
}
