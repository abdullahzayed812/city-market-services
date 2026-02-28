export interface Product {
  id: string;
  vendorId: string;
  globalCategoryId: string;
  vendorCategoryId: string;
  globalCategoryName?: string | null;
  vendorCategoryName?: string | null;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}
