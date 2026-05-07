export type MediaFolder = "products" | "categories" | "vendors" | "globals";

export const ALLOWED_FOLDERS: readonly MediaFolder[] = [
  "products",
  "categories",
  "vendors",
  "globals",
];

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
