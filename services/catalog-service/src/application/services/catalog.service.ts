import { randomUUID } from "crypto";
import { IVendorProductRepository } from "../../core/interfaces/vendor-product.repository";
import { ICategoryRepository } from "../../core/interfaces/category.repository";
import { IGlobalProductRepository } from "../../core/interfaces/global-product.repository";
import { VendorProduct } from "../../core/entities/vendor-product.entity";
import { GlobalProduct } from "../../core/entities/global-product.entity";
import { CreateVendorProductDto, UpdateVendorProductDto, VendorProductFilter } from "../../core/dto/vendor-product.dto";
import { NotFoundError, CategoryType, MeasurementType, EventType } from "@city-market/shared";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const LOW_STOCK_THRESHOLD_UNITS = 10;
const LOW_STOCK_THRESHOLD_GRAMS = 1000;

export class CatalogService {
  constructor(
    private vendorProductRepo: IVendorProductRepository,
    private categoryRepo: ICategoryRepository,
    private globalProductRepo: IGlobalProductRepository,
  ) {}

  async createVendorProduct(dto: CreateVendorProductDto): Promise<VendorProduct> {
    const globalCat = await this.categoryRepo.findById(dto.globalCategoryId);
    if (!globalCat || globalCat.type !== CategoryType.GLOBAL) {
      throw new Error("invalid_global_category");
    }

    const vendorCat = await this.categoryRepo.findById(dto.vendorCategoryId);
    if (!vendorCat || vendorCat.type !== CategoryType.VENDOR || vendorCat.vendorId !== dto.vendorId) {
      throw new Error("invalid_vendor_category");
    }

    let globalProductId = dto.globalProductId;

    // Backward compatibility: If no globalProductId, create a new GlobalProduct
    if (!globalProductId) {
      const globalProduct: GlobalProduct = {
        id: randomUUID(),
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        globalCategoryId: dto.globalCategoryId,
        measurementType: dto.measurementType || MeasurementType.UNIT,
        weightUnit: dto.weightUnit,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.globalProductRepo.create(globalProduct);
      globalProductId = globalProduct.id;
    } else {
      const existingGlobal = await this.globalProductRepo.findById(globalProductId);
      if (!existingGlobal) {
        throw new Error("global_product_not_found");
      }
    }

    const product: VendorProduct = {
      id: randomUUID(),
      vendorId: dto.vendorId,
      globalProductId: globalProductId,
      globalCategoryId: dto.globalCategoryId,
      vendorCategoryId: dto.vendorCategoryId,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      stockQuantity: dto.stockQuantity || 0,
      stockWeightGrams: dto.stockWeightGrams || 0,
      imageUrl: dto.imageUrl,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    return this.vendorProductRepo.create(product);
  }

  async getVendorProductById(id: string): Promise<VendorProduct> {
    const product = await this.vendorProductRepo.findById(id);
    if (!product) {
      throw new NotFoundError("vendor_product_not_found");
    }
    return product;
  }

  async getAllVendorProducts(
    page: number,
    limit: number,
    globalCategoryId?: string,
    vendorCategoryId?: string,
    vendorId?: string,
    search?: string,
  ): Promise<{ products: VendorProduct[]; total: number }> {
    const offset = (page - 1) * limit;
    const filters: VendorProductFilter = { globalCategoryId, vendorCategoryId, vendorId, search };
    const [products, total] = await Promise.all([
      this.vendorProductRepo.findByFilter(filters, limit, offset),
      this.vendorProductRepo.countByFilter(filters),
    ]);
    return { products, total };
  }

  async getVendorProductsByVendor(
    vendorId: string,
    page: number,
    limit: number,
  ): Promise<{ products: VendorProduct[]; total: number }> {
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.vendorProductRepo.findByVendor(vendorId, limit, offset),
      this.vendorProductRepo.countByFilter({ vendorId }),
    ]);
    return { products, total };
  }

  async getVendorProductsByCategory(
    categoryId: string,
    page: number,
    limit: number,
  ): Promise<{ products: VendorProduct[]; total: number }> {
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.vendorProductRepo.findByCategory(categoryId, limit, offset),
      this.vendorProductRepo.countByFilter({ globalCategoryId: categoryId }),
    ]);
    return { products, total };
  }

  async searchVendorProducts(
    filter: VendorProductFilter,
    page: number,
    limit: number,
  ): Promise<{ products: VendorProduct[]; total: number }> {
    const offset = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.vendorProductRepo.findByFilter(filter, limit, offset),
      this.vendorProductRepo.countByFilter(filter),
    ]);
    return { products, total };
  }

  async updateVendorProduct(id: string, data: UpdateVendorProductDto): Promise<void> {
    const product = await this.getVendorProductById(id);

    if (data.globalCategoryId) {
      const globalCat = await this.categoryRepo.findById(data.globalCategoryId);
      if (!globalCat || globalCat.type !== CategoryType.GLOBAL) {
        throw new Error("invalid_global_category");
      }
    }

    if (data.vendorCategoryId) {
      const vendorCat = await this.categoryRepo.findById(data.vendorCategoryId);
      if (!vendorCat || vendorCat.type !== CategoryType.VENDOR || vendorCat.vendorId !== product.vendorId) {
        throw new Error("invalid_vendor_category");
      }
    }

    if (data.globalProductId) {
      const globalProduct = await this.globalProductRepo.findById(data.globalProductId);
      if (!globalProduct) {
        throw new Error("global_product_not_found");
      }
    }

    const vendorUpdate: Partial<VendorProduct> = {
      price: data.price,
      stockQuantity: data.stockQuantity,
      stockWeightGrams: data.stockWeightGrams,
      isAvailable: data.isAvailable,
      vendorCategoryId: data.vendorCategoryId,
      globalProductId: data.globalProductId,
    };

    await this.vendorProductRepo.update(id, vendorUpdate);
  }

  async updateVendorStock(id: string, stock: number): Promise<void> {
    await this.getVendorProductById(id);
    await this.vendorProductRepo.updateStock(id, stock);
  }

  async updateVendorWeightStock(id: string, weight: number): Promise<void> {
    await this.getVendorProductById(id);
    await this.vendorProductRepo.updateWeightStock(id, weight);
  }

  async updateVendorProductPrice(id: string, price: number): Promise<void> {
    await this.vendorProductRepo.updatePrice(id, price);
  }

  async decrementVendorStock(
    id: string,
    amount: number,
    type: MeasurementType = MeasurementType.UNIT,
    vendorUserId?: string,
  ): Promise<void> {
    // await this.getVendorProductById(id);
    if (type === MeasurementType.UNIT) {
      await this.vendorProductRepo.decrementStock(id, amount);
    } else {
      await this.vendorProductRepo.decrementWeightStock(id, amount);
    }

    // Check for low stock after decrement
    try {
      const product = await this.getVendorProductById(id);
      await this.checkLowStock(product, vendorUserId);
    } catch (error) {
      Logger.error(`Failed to check low stock for product ${id}`, error);
    }
  }

  private async checkLowStock(product: VendorProduct, vendorUserId?: string): Promise<void> {
    let isLow = false;
    let remaining = 0;

    if (product.measurementType === MeasurementType.UNIT) {
      isLow = product.stockQuantity <= LOW_STOCK_THRESHOLD_UNITS;
      remaining = product.stockQuantity;
    } else {
      isLow = (product.stockWeightGrams || 0) <= LOW_STOCK_THRESHOLD_GRAMS;
      remaining = product.stockWeightGrams || 0;
    }

    if (isLow && product.isAvailable) {
      Logger.info(
        `[CatalogService] Low stock detected for product ${product.name} (${product.id}). Remaining: ${remaining}`,
      );

      await rabbitMQBus.publish({
        type: EventType.LOW_STOCK,
        payload: {
          vendorProductId: product.id,
          vendorId: product.vendorId,
          vendorUserId,
          productName: product.name,
          remaining,
          measurementType: product.measurementType,
        },
        createdAt: new Date(),
      });
    }
  }

  async reserveVendorWeightStock(id: string, weightGrams: number): Promise<void> {
    await this.getVendorProductById(id);
    await this.vendorProductRepo.reserveWeightStock(id, weightGrams);
  }

  async releaseVendorWeightStock(id: string, weightGrams: number): Promise<void> {
    await this.getVendorProductById(id);
    await this.vendorProductRepo.releaseWeightStock(id, weightGrams);
  }

  async commitVendorWeightStock(id: string, actualWeightGrams: number, reservedWeightGrams: number): Promise<void> {
    await this.getVendorProductById(id);
    await this.vendorProductRepo.commitWeightStock(id, actualWeightGrams, reservedWeightGrams);
  }

  async updateVendorProductImage(id: string, imageUrl: string): Promise<void> {
    const product = await this.getVendorProductById(id);
    await this.globalProductRepo.update(product.globalProductId, { imageUrl });
  }

  async reserveStock(id: string, quantity: number, weightGrams: number): Promise<boolean> {
    const success = await this.vendorProductRepo.reserveStock(id, quantity, weightGrams);
    if (success) {
      await this.checkAndSyncAvailability(id);
    }
    return success;
  }

  async releaseStock(id: string, quantity: number, weightGrams: number): Promise<void> {
    await this.vendorProductRepo.releaseStock(id, quantity, weightGrams);
    await this.checkAndSyncAvailability(id);
  }

  async commitStock(id: string, quantity: number, actualWeightGrams: number, reservedWeightGrams: number): Promise<void> {
    await this.vendorProductRepo.commitStock(id, quantity, actualWeightGrams, reservedWeightGrams);
    await this.checkAndSyncAvailability(id);
  }

  private async checkAndSyncAvailability(id: string): Promise<void> {
    const product = await this.vendorProductRepo.findById(id);
    if (!product) return;

    const available =
      product.measurementType === MeasurementType.UNIT
        ? product.stockQuantity - product.reservedQuantity
        : (product.stockWeightGrams || 0) - (product.reservedWeightGrams || 0);

    const shouldBeAvailable = available > 0;

    if (product.isAvailable !== shouldBeAvailable) {
      Logger.info(
        `[CatalogService] Toggling availability for product ${product.id} to ${shouldBeAvailable} (available: ${available})`,
      );
      await this.vendorProductRepo.update(id, { isAvailable: shouldBeAvailable });

      await rabbitMQBus.publish({
        type: EventType.PRODUCT_AVAILABILITY_CHANGED,
        payload: {
          vendorProductId: product.id,
          vendorId: product.vendorId,
          isAvailable: shouldBeAvailable,
          availableAmount: available,
        },
        createdAt: new Date(),
      });
    }
  }

  async deleteVendorProduct(id: string): Promise<void> {
    await this.getVendorProductById(id);
    await this.vendorProductRepo.delete(id);
  }

  // --- Global Product Management ---

  async createGlobalProduct(data: Partial<GlobalProduct>): Promise<GlobalProduct> {
    const globalProduct: GlobalProduct = {
      id: randomUUID(),
      name: data.name!,
      description: data.description,
      imageUrl: data.imageUrl,
      globalCategoryId: data.globalCategoryId!,
      measurementType: data.measurementType || MeasurementType.UNIT,
      weightUnit: data.weightUnit,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.globalProductRepo.create(globalProduct);
  }

  async getAllGlobalProducts(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: GlobalProduct[]; total: number }> {
    const offset = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.globalProductRepo.findAll(limit, offset, search),
      this.globalProductRepo.count(search),
    ]);
    return { data: items, total };
  }

  async getGlobalProductById(id: string): Promise<GlobalProduct> {
    const item = await this.globalProductRepo.findById(id);
    if (!item) {
      throw new NotFoundError("global_product_not_found");
    }
    return item;
  }

  async updateGlobalProduct(id: string, data: Partial<GlobalProduct>): Promise<void> {
    await this.getGlobalProductById(id);
    await this.globalProductRepo.update(id, data);
  }

  async deleteGlobalProduct(id: string): Promise<void> {
    await this.getGlobalProductById(id);
    await this.globalProductRepo.delete(id);
  }
}
