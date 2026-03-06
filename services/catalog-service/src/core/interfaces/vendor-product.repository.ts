import { VendorProduct } from "../entities/vendor-product.entity";
import { VendorProductFilter } from "../dto/vendor-product.dto";

export interface IVendorProductRepository {
  create(product: VendorProduct): Promise<VendorProduct>;
  findAll(limit: number, offset: number): Promise<VendorProduct[]>;
  countAll(): Promise<number>;
  countByFilter(filter: VendorProductFilter): Promise<number>;
  findById(id: string): Promise<VendorProduct | null>;
  findByVendor(vendorId: string, limit: number, offset: number): Promise<VendorProduct[]>;
  findByCategory(categoryId: string, limit: number, offset: number): Promise<VendorProduct[]>;
  findByFilter(filter: VendorProductFilter, limit: number, offset: number): Promise<VendorProduct[]>;
  update(id: string, data: Partial<VendorProduct>): Promise<void>;
  updateStock(id: string, quantity: number): Promise<void>;
  delete(id: string): Promise<void>;
  decrementStock(id: string, quantity: number): Promise<void>;
}
