export interface Product {
  id: string;
  vendorId: string;
  categoryId?: string;
  categoryName?: string | null;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface CreateProductDto {
  vendorId: string;
  categoryId?: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stockQuantity?: number;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface ProductFilter {
  vendorId?: string;
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
}
