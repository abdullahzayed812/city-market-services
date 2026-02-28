import { Category } from "../entities/category.entity";
import { CategoryType } from "@city-market/shared";

export interface ICategoryRepository {
  create(category: Category): Promise<Category>;
  findById(id: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  findByType(type: CategoryType, vendorId?: string): Promise<Category[]>;
  update(id: string, data: Partial<Category>): Promise<void>;
  delete(id: string): Promise<void>;
}
