import { MeasurementType, WeightUnit } from "@city-market/shared";

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
