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

// ── Merchant new-product proposals ───────────────────────────────────────────

export type ProductSubmissionStatusValue = "PENDING_REVIEW" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ProductSubmissionHistoryEntry {
  id: string;
  submissionId: string;
  action: string;
  status: ProductSubmissionStatusValue;
  revision: number;
  note: string | null;
  // Only returned to admins
  actorUserId?: string | null;
  actorRole?: string | null;
  // The proposal's fields at that point
  snapshot?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ProductSubmission {
  id: string;
  vendorId: string;
  status: ProductSubmissionStatusValue;
  name: string;
  description: string | null;
  globalCategoryId: string;
  globalCategoryName?: string | null;
  measurementType: MeasurementType;
  weightUnit: WeightUnit | null;
  // Short-lived signed URL of the private (unpublished) image; only for the owner and admins
  imageUrl?: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  revision: number;
  // Latest admin feedback (reason for rejection, or the changes requested)
  reviewNote: string | null;
  reviewedAt: string | null;
  resolution: "CREATED" | "LINKED_EXISTING" | null;
  globalProductId: string | null;
  vendorProductId: string | null;
  vendorAcknowledgedDuplicates: boolean;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  // Admin views only
  submittedByUserId?: string;
  reviewedBy?: string | null;
  history?: ProductSubmissionHistoryEntry[];
}

export interface ProductDuplicateMatch {
  globalProductId: string;
  name: string;
  imageUrl?: string | null;
  globalCategoryId: string;
  globalCategoryName?: string | null;
  measurementType: MeasurementType;
  weightUnit?: WeightUnit | null;
  // 0..1 name similarity after Arabic / Latin normalization
  score: number;
  exact: boolean;
  sameCategory: boolean;
}

export interface SimilarPendingSubmission {
  id: string;
  vendorId: string;
  name: string;
  status: ProductSubmissionStatusValue;
  score: number;
  submittedAt: string;
}

export interface ProductSubmissionInput {
  name: string;
  description?: string | null;
  globalCategoryId: string;
  measurementType: MeasurementType;
  weightUnit?: WeightUnit | null;
  // Key returned by POST /media/submission-images
  imageKey: string;
  // The merchant saw the possible matches and says this is a different product
  acknowledgedDuplicates?: boolean;
}

export interface SubmissionImageRules {
  formats: string[];
  mimeTypes: string[];
  minWidth: number;
  minHeight: number;
  maxBytes: number;
}

export interface SubmissionImageUploadResult {
  key: string;
  width: number;
  height: number;
  bytes: number;
  // Short-lived signed preview URL
  previewUrl: string;
}

export interface ProductSubmissionDecisionResult {
  submission: ProductSubmission;
  // True when the request repeated a decision already made (no change, no new notification)
  alreadyApplied?: boolean;
}
