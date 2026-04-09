import { ShopStatus } from "@city-market/shared";

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
  createdAt: Date;
  updatedAt: Date;
}
