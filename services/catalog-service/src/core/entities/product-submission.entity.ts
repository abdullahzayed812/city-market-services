import {
  MeasurementType,
  ProductSubmissionAction,
  ProductSubmissionResolution,
  ProductSubmissionStatus,
  WeightUnit,
} from "@city-market/shared";

export interface ProductSubmissionRecord {
  id: string;
  vendorId: string;
  submittedByUserId: string;
  status: ProductSubmissionStatus;
  name: string;
  normalizedName: string;
  description: string | null;
  globalCategoryId: string;
  globalCategoryName?: string | null;
  measurementType: MeasurementType;
  weightUnit: WeightUnit | null;
  imageKey: string;
  imageWidth: number | null;
  imageHeight: number | null;
  revision: number;
  vendorAcknowledgedDuplicates: boolean;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  resolution: ProductSubmissionResolution | null;
  reservedGlobalProductId: string | null;
  globalProductId: string | null;
  vendorProductId: string | null;
  // Image of the published global product (approved submissions)
  publishedImageUrl?: string | null;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSubmissionHistoryRecord {
  id: string;
  submissionId: string;
  action: ProductSubmissionAction;
  status: ProductSubmissionStatus;
  revision: number;
  note: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  snapshot: Record<string, unknown> | null;
  createdAt: Date;
}

// A global product returned as a possible duplicate
export interface CatalogCandidate {
  id: string;
  name: string;
  imageUrl: string | null;
  globalCategoryId: string;
  globalCategoryName: string | null;
  measurementType: MeasurementType;
  weightUnit: WeightUnit | null;
}
