export type MediaFolder = "products" | "categories" | "vendors" | "globals" | "courier-documents" | "office-documents";

export const ALLOWED_FOLDERS: readonly MediaFolder[] = [
  "products",
  "categories",
  "vendors",
  "globals",
  "courier-documents",
  "office-documents",
];

// The only folder a COURIER may upload to (ID / license photos at freelance signup)
export const COURIER_DOCUMENTS_FOLDER: MediaFolder = "courier-documents";
// The only folder a DELIVERY_MANAGER may upload to (owner ID / commercial register at office signup)
export const OFFICE_DOCUMENTS_FOLDER: MediaFolder = "office-documents";

export type ImageVariant = "small" | "medium" | "large";

export interface ImageVariantConfig {
  width: number;
}

export const IMAGE_VARIANTS: Record<ImageVariant, ImageVariantConfig> = {
  small: { width: 300 },
  medium: { width: 600 },
  large: { width: 1200 },
};

export interface MediaUploadResult {
  url: string;
  sizes: {
    small: string;
    medium: string;
    large: string;
  };
}
