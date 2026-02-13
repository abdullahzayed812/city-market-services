import { ShopStatus } from "@city-market/shared";

export interface CreateVendorDto {
  userId: string;
  shopName: string;
  shopDescription?: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
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
