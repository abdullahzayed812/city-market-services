import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { IProductRepository } from "../../core/interfaces/product.repository";
import { ICategoryRepository } from "../../core/interfaces/category.repository";
import { Product } from "../../core/entities/product.entity";
import { CreateProductDto, UpdateProductDto, ProductFilter } from "../../core/dto/product.dto";
import { NotFoundError, CategoryType } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";

export class ProductService {
  constructor(
    private productRepo: IProductRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const globalCat = await this.categoryRepo.findById(dto.globalCategoryId);
    if (!globalCat || globalCat.type !== CategoryType.GLOBAL) {
      throw new Error("Invalid global category");
    }

    const vendorCat = await this.categoryRepo.findById(dto.vendorCategoryId);
    if (!vendorCat || vendorCat.type !== CategoryType.VENDOR || vendorCat.vendorId !== dto.vendorId) {
      throw new Error("Invalid vendor-specific category for this vendor");
    }

    const product: Product = {
      id: randomUUID(),
      vendorId: dto.vendorId,
      globalCategoryId: dto.globalCategoryId,
      vendorCategoryId: dto.vendorCategoryId,
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

  async getAllProducts(
    page: number, 
    limit: number, 
    globalCategoryId?: string, 
    vendorCategoryId?: string
  ): Promise<{ products: Product[]; total: number }> {
    const offset = (page - 1) * limit;
    const filters: ProductFilter = { globalCategoryId, vendorCategoryId };
    const [products, total] = await Promise.all([
      this.productRepo.findByFilter(filters, limit, offset),
      this.productRepo.countByFilter(filters)
    ]);
    return { products, total };
  }

  async getProductsByVendor(vendorId: string, page: number, limit: number): Promise<{ products: Product[]; total: number }> {
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.productRepo.findByVendor(vendorId, limit, offset),
      this.productRepo.countByFilter({ vendorId })
    ]);
    return { products, total };
  }

  async getProductsByCategory(categoryId: string, page: number, limit: number): Promise<{ products: Product[]; total: number }> {
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.productRepo.findByCategory(categoryId, limit, offset),
      this.productRepo.countByFilter({ globalCategoryId: categoryId }) 
    ]);
    return { products, total };
  }

  async searchProducts(filter: ProductFilter, page: number, limit: number): Promise<{ products: Product[]; total: number }> {
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.productRepo.findByFilter(filter, limit, offset),
      this.productRepo.countByFilter(filter)
    ]);
    return { products, total };
  }

  async updateProduct(id: string, data: UpdateProductDto): Promise<void> {
    const product = await this.getProductById(id);

    if (data.globalCategoryId) {
       const globalCat = await this.categoryRepo.findById(data.globalCategoryId);
       if (!globalCat || globalCat.type !== CategoryType.GLOBAL) {
         throw new Error("Invalid global category");
       }
    }

    if (data.vendorCategoryId) {
       const vendorCat = await this.categoryRepo.findById(data.vendorCategoryId);
       if (!vendorCat || vendorCat.type !== CategoryType.VENDOR || vendorCat.vendorId !== product.vendorId) {
         throw new Error("Invalid vendor category for this vendor");
       }
    }

    await this.productRepo.update(id, data as any);
  }

  async updateStock(id: string, stock: number): Promise<void> {
    await this.getProductById(id);
    await this.productRepo.updateStock(id, stock);
  }

  async updateProductImage(id: string, imageUrl: string): Promise<void> {
    const product = await this.getProductById(id);
    
    if (product.imageUrl && product.imageUrl.startsWith("/catalog/uploads/products/")) {
      try {
        const oldImagePath = path.join(process.cwd(), product.imageUrl.replace("/catalog", ""));
        await fs.unlink(oldImagePath);
        Logger.info("Old product image deleted", { path: oldImagePath });
      } catch (error) {
        Logger.error("Failed to delete old product image", { error });
      }
    }

    await this.productRepo.update(id, { imageUrl } as any);
  }

  async deleteProduct(id: string): Promise<void> {
    await this.getProductById(id);
    await this.productRepo.delete(id);
  }
}
