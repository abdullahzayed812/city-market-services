import { MeasurementType, WeightUnit } from "../../../../../shared/src/enums/index.js";

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
  stockWeightGrams?: number;
  reservedWeightGrams?: number;
  measurementType: MeasurementType;
  weightUnit?: WeightUnit;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}
