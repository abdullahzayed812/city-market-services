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
  updateWeightStock(id: string, weight: number): Promise<void>;
  updatePrice(id: string, price: number): Promise<void>;
  delete(id: string): Promise<void>;
  decrementStock(id: string, quantity: number): Promise<void>;
  decrementWeightStock(id: string, weight: number): Promise<void>;
  reserveStock(id: string, quantity: number, weightGrams: number): Promise<boolean>;
  releaseStock(id: string, quantity: number, weightGrams: number): Promise<void>;
  commitStock(id: string, quantity: number, weightGrams: number): Promise<void>;
  reserveWeightStock(id: string, weight: number): Promise<void>;
  releaseWeightStock(id: string, weight: number): Promise<void>;
  commitWeightStock(id: string, actualWeight: number, reservedWeight: number): Promise<void>;
}
