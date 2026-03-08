import { MeasurementType, WeightUnit } from "../../../../../shared/src/enums/index.js";

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
