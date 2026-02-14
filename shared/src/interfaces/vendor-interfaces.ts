import { ShopStatus } from "../enums/shop-status";

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
  status: ShopStatus;
  commissionRate: number;
  isActive: boolean;
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
