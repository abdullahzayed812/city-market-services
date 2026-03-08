import { CategoryType } from "../enums/category-type.enum.js";
import { MeasurementType } from "../enums/measurement-type.enum.js";
import { WeightUnit } from "../enums/weight-unit.enum.js";

export interface GlobalProduct {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  globalCategoryId: string;
  measurementType: MeasurementType;
  weightUnit?: WeightUnit;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorProduct {
  id: string;
  vendorId: string;
  globalProductId: string;
  globalCategoryId: string;
  vendorCategoryId: string;
  globalCategoryName?: string | null;
  vendorCategoryName?: string | null;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  stockWeight?: number;
  stockWeightGrams?: number;
  reservedWeightGrams?: number;
  measurementType: MeasurementType;
  weightUnit?: WeightUnit;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  vendorId?: string | null;
  description?: string;
  iconUrl?: string;
  color?: string;
  createdAt: Date;
}

export interface CreateVendorProductDto {
  vendorId: string;
  globalProductId?: string;
  globalCategoryId: string;
  vendorCategoryId: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity?: number;
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

export interface CreateCategoryDto {
  name: string;
  type: CategoryType;
  vendorId?: string | null;
  description?: string;
  iconUrl?: string;
  color?: string;
}
