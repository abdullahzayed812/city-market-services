export interface CreateVendorProductDto {
  vendorId: string;
  globalProductId: string;
  globalCategoryId: string;
  vendorCategoryId: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
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
