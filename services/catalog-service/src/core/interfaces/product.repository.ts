import { Product } from "../entities/product.entity";
import { ProductFilter } from "../dto/product.dto";

export interface IProductRepository {
  create(product: Product): Promise<Product>;
  findAll(limit: number, offset: number): Promise<Product[]>;
  countAll(): Promise<number>;
  countByFilter(filter: ProductFilter): Promise<number>;
  findById(id: string): Promise<Product | null>;
  findByVendor(vendorId: string, limit: number, offset: number): Promise<Product[]>;
  findByCategory(categoryId: string, limit: number, offset: number): Promise<Product[]>;
  findByFilter(filter: ProductFilter, limit: number, offset: number): Promise<Product[]>;
  update(id: string, data: Partial<Product>): Promise<void>;
  updateStock(id: string, quantity: number): Promise<void>;
  delete(id: string): Promise<void>;
  decrementStock(id: string, quantity: number): Promise<void>;
}
