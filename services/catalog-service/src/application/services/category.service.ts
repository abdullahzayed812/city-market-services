import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ICategoryRepository } from "../../core/interfaces/category.repository";
import { Category } from "../../core/entities/category.entity";
import { NotFoundError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";

export interface CreateCategoryDto {
  name: string;
  description?: string;
  iconUrl?: string;
  color?: string;
}

export class CategoryService {
  constructor(private categoryRepo: ICategoryRepository) {}

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const category: Category = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      iconUrl: dto.iconUrl,
      color: dto.color,
      createdAt: new Date(),
    };

    return this.categoryRepo.create(category);
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return category;
  }

  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepo.findAll();
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<void> {
    await this.getCategoryById(id);
    await this.categoryRepo.update(id, data);
  }

  async updateCategoryIcon(id: string, iconUrl: string): Promise<void> {
    const category = await this.getCategoryById(id);

    if (category.iconUrl) {
      try {
        const oldIconPath = path.join(process.cwd(), category.iconUrl.replace("/catalog", ""));
        await fs.unlink(oldIconPath);
        Logger.info("Old category icon deleted", { path: oldIconPath });
      } catch (error) {
        Logger.error("Failed to delete old category icon", { error });
      }
    }

    await this.categoryRepo.update(id, { iconUrl });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.getCategoryById(id);
    await this.categoryRepo.delete(id);
  }
}
