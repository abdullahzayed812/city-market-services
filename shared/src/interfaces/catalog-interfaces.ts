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
  vendorName?: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  stockWeightGrams?: number;
  reservedWeightGrams?: number;
  reservedQuantity?: number;
  measurementType: MeasurementType; // Fetched from GlobalProduct, but needed in interface for UI
  weightUnit?: WeightUnit; // Fetched from GlobalProduct, but needed in interface for UI
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
  stockWeightGrams?: number;
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
  stockWeightGrams?: number;
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

export interface BulkAddVendorProductsFromGlobalItem {
  globalProductId: string;
  price?: number;
  stockQuantity?: number;
  stockWeightGrams?: number;
}

export interface BulkAddVendorProductsFromGlobalDto {
  items: BulkAddVendorProductsFromGlobalItem[];
  /** Applied to every product in the batch (both the explicit-items and import-all-from-category paths). */
  vendorCategoryId?: string;
}

export interface BulkAddVendorProductsFromGlobalResult {
  added: number;
  skipped: number;
  addedProductIds: string[];
  skippedProductIds: string[];
}

export interface CreateCategoryDto {
  name: string;
  type: CategoryType;
  vendorId?: string | null;
  description?: string;
  iconUrl?: string;
  color?: string;
}
