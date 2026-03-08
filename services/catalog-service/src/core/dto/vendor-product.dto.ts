import { MeasurementType, WeightUnit } from "@city-market/shared";

export interface CreateVendorProductDto {
  vendorId: string;
  globalProductId: string;
  globalCategoryId: string;
  vendorCategoryId: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  stockWeight?: number;
  stockWeightGrams?: number;
  measurementType?: MeasurementType;
  weightUnit?: WeightUnit;
  imageUrl?: string;
}

export interface UpdateVendorProductDto {
  globalProductId?: string;
  globalCategoryId?: string;
  vendorCategoryId?: string;
  name?: string;
  description?: string;
  price?: number;
  stockQuantity?: number;
  stockWeight?: number;
  stockWeightGrams?: number;
  measurementType?: MeasurementType;
  weightUnit?: WeightUnit;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface VendorProductFilter {
  vendorId?: string;
  globalCategoryId?: string;
  vendorCategoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
}
