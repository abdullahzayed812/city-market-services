export interface CreateProductDto {
  vendorId: string;
  globalCategoryId: string;
  vendorCategoryId: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
}

export interface UpdateProductDto {
  globalCategoryId?: string;
  vendorCategoryId?: string;
  name?: string;
  description?: string;
  price?: number;
  stockQuantity?: number;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface ProductFilter {
  vendorId?: string;
  globalCategoryId?: string;
  vendorCategoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
}
