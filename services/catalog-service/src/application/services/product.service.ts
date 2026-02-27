import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { IProductRepository } from "../../core/interfaces/product.repository";
import { Product } from "../../core/entities/product.entity";
import { CreateProductDto, UpdateProductDto, ProductFilter } from "../../core/dto/product.dto";
import { ValidationError, NotFoundError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";

export class ProductService {
  constructor(private productRepo: IProductRepository) { }

  async getAllProducts(page: number = 1, limit: number = 20, categoryId?: string): Promise<{ products: Product[]; total: number }> {
    const offset = (page - 1) * limit;
    if (categoryId) {
      const filter: ProductFilter = { categoryId };
      const products = await this.productRepo.findByFilter(filter, limit, offset);
      const total = await this.productRepo.countByFilter(filter);
      return { products, total };
    }
    const products = await this.productRepo.findAll(limit, offset);
    const total = await this.productRepo.countAll();
    return { products, total };
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    if (dto.price <= 0) {
      throw new ValidationError("Price must be greater than 0");
    }

    if (dto.stockQuantity < 0) {
      throw new ValidationError("Stock quantity cannot be negative");
    }

    const product: Product = {
      id: randomUUID(),
      vendorId: dto.vendorId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      stockQuantity: dto.stockQuantity,
      imageUrl: dto.imageUrl,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.productRepo.create(product);
  }

  async getProductById(id: string): Promise<Product> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  async getProductsByVendor(vendorId: string, page: number = 1, limit: number = 20): Promise<Product[]> {
    const offset = (page - 1) * limit;
    return this.productRepo.findByVendor(vendorId, limit, offset);
  }

  async getProductsByCategory(categoryId: string, page: number = 1, limit: number = 20): Promise<Product[]> {
    const offset = (page - 1) * limit;
    return this.productRepo.findByCategory(categoryId, limit, offset);
  }

  async searchProducts(filter: ProductFilter, page: number = 1, limit: number = 20): Promise<Product[]> {
    const offset = (page - 1) * limit;
    return this.productRepo.findByFilter(filter, limit, offset);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<void> {
    const product = await this.getProductById(id);

    if (dto.price !== undefined && dto.price <= 0) {
      throw new ValidationError("Price must be greater than 0");
    }

    if (dto.stockQuantity !== undefined && dto.stockQuantity < 0) {
      throw new ValidationError("Stock quantity cannot be negative");
    }

    await this.productRepo.update(id, dto);
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    if (quantity < 0) {
      throw new ValidationError("Stock quantity cannot be negative");
    }
    await this.productRepo.updateStock(id, quantity);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.getProductById(id);

    // Delete image if it exists
    if (product.imageUrl) {
      try {
        const imagePath = path.join(process.cwd(), product.imageUrl.replace("/catalog", ""));
        await fs.unlink(imagePath);
        Logger.info("Product image deleted on record deletion", { path: imagePath });
      } catch (error) {
        Logger.error("Failed to delete product image during deletion", { error });
      }
    }

    await this.productRepo.delete(id);
  }

  async checkAndDecrementStock(productId: string, quantity: number): Promise<boolean> {
    const product = await this.getProductById(productId);

    if (!product.isAvailable) {
      return false;
    }

    if (product.stockQuantity < quantity) {
      return false;
    }

    await this.productRepo.decrementStock(productId, quantity);
    return true;
  }

  async updateProductImage(id: string, imageUrl: string): Promise<void> {
    const product = await this.getProductById(id);

    // Delete old image if it exists
    if (product.imageUrl) {
      try {
        const oldImagePath = path.join(process.cwd(), product.imageUrl.replace("/catalog", ""));
        await fs.unlink(oldImagePath);
        Logger.info("Old product image deleted", { path: oldImagePath });
      } catch (error) {
        Logger.error("Failed to delete old product image", { error });
      }
    }

    await this.productRepo.update(id, { imageUrl });
  }
}
