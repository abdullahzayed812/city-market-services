import { PoolConnection } from "mysql2/promise";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { CreateOrderDto } from "../../core/dto/order.dto";
import { CatalogHttpClient, ProductInfo } from "../../infrastructure/http/catalog-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";
import { OrderStateManager } from "./order-state.manager";
import { 
  CustomerOrderStatus, 
  VendorOrderStatus, 
  ValidationError, 
  MeasurementType, 
  PricingStrategyFactory 
} from "@city-market/shared";
import { randomUUID } from "crypto";
import { CustomerOrder } from "../../core/entities/customer-order.entity";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { VendorOrderItem } from "../../core/entities/vendor-order-item.entity";

const DELIVERY_FEE = 15.0;
const COMMISSION_RATE = 0.1;

export class OrderCreationManager {
  constructor(
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private vendorOrderItemRepo: IVendorOrderItemRepository,
    private catalogClient: CatalogHttpClient,
    private vendorClient: VendorHttpClient,
    private publisher: OrderPublisher,
    private stateManager: OrderStateManager
  ) {}

  async create(dto: CreateOrderDto, userId?: string, connection?: PoolConnection): Promise<{ order: CustomerOrder, vendorOrders: (VendorOrder & { items: VendorOrderItem[] })[] }> {
    if (dto.items.length === 0) {
      throw new ValidationError("order_must_have_at_least_one_item");
    }

    const productInfos = await this.fetchAndValidateProducts(dto, userId);
    const vendorItemsMap = this.groupByVendor(dto, productInfos);
    const { totalSubtotal, vendorOrdersData } = this.calculateTotals(vendorItemsMap);

    const customerOrder = await this.createCustomerOrderRecord(dto, totalSubtotal, connection!);
    const createdVendorOrders = await this.createVendorOrderRecords(customerOrder, vendorOrdersData, userId, connection!);

    await this.handleStockOperations(dto, productInfos, userId);
    await this.publisher.publishOrderCreated(customerOrder.id, customerOrder.customerId);

    return { order: customerOrder, vendorOrders: createdVendorOrders };
  }

  private async fetchAndValidateProducts(dto: CreateOrderDto, userId?: string) {
    const productInfos = await Promise.all(
      dto.items.map((item) => this.catalogClient.getVendorProduct(item.vendorProductId, userId))
    );

    for (let i = 0; i < productInfos.length; i++) {
      const product = productInfos[i];
      const requestedItem = dto.items[i];

      if (!product) throw new ValidationError("product_not_found");
      if (!product.isAvailable) throw new ValidationError("product_not_available");

      if (product.measurementType === MeasurementType.UNIT) {
        if (requestedItem.weight !== undefined || requestedItem.weightGrams !== undefined) {
          throw new ValidationError("unit_product_cannot_have_weight");
        }
        if (requestedItem.quantity === undefined || requestedItem.quantity <= 0) {
          throw new ValidationError("invalid_quantity");
        }
        if (product.stockQuantity < requestedItem.quantity) {
          throw new ValidationError("insufficient_stock");
        }
      } else if (product.measurementType === MeasurementType.WEIGHT) {
        if (requestedItem.quantity !== undefined) {
          throw new ValidationError("weight_product_cannot_have_quantity");
        }
        const weightGrams = requestedItem.weightGrams || (requestedItem.weight ? Math.round(requestedItem.weight * 1000) : undefined);
        if (weightGrams === undefined || weightGrams <= 0) throw new ValidationError("invalid_weight");
        
        const availableWeight = (product.stockWeightGrams || 0) - (product.reservedWeightGrams || 0);
        if (availableWeight < weightGrams) throw new ValidationError("insufficient_stock");
        
        requestedItem.weightGrams = weightGrams;
      }
    }
    return productInfos as ProductInfo[];
  }

  private groupByVendor(dto: CreateOrderDto, productInfos: ProductInfo[]) {
    const vendorItemsMap = new Map<string, { product: ProductInfo; amount: number }[]>();
    for (let i = 0; i < productInfos.length; i++) {
      const product = productInfos[i];
      const requestedItem = dto.items[i];
      const amount = product.measurementType === MeasurementType.UNIT ? requestedItem.quantity! : requestedItem.weightGrams!;
      const vendorItems = vendorItemsMap.get(product.vendorId) || [];
      vendorItems.push({ product, amount });
      vendorItemsMap.set(product.vendorId, vendorItems);
    }
    return vendorItemsMap;
  }

  private calculateTotals(vendorItemsMap: Map<string, { product: ProductInfo; amount: number }[]>) {
    let totalSubtotal = 0;
    const vendorOrdersData: any[] = [];

    for (const [vendorId, items] of vendorItemsMap.entries()) {
      let vendorSubtotal = 0;
      const vendorItemsData: VendorOrderItem[] = [];

      for (const item of items) {
        const strategy = PricingStrategyFactory.getStrategy(item.product.measurementType);
        const itemTotal = strategy.calculateTotal(item.product.price, item.amount);
        vendorSubtotal += itemTotal;

        vendorItemsData.push({
          id: randomUUID(),
          vendorOrderId: "",
          vendorProductId: item.product.id,
          productName: item.product.name,
          quantity: item.product.measurementType === MeasurementType.UNIT ? item.amount : undefined,
          requestedWeight: item.product.measurementType === MeasurementType.WEIGHT ? item.amount / 1000 : undefined,
          requestedWeightGrams: item.product.measurementType === MeasurementType.WEIGHT ? item.amount : undefined,
          unitPrice: item.product.price,
          totalPrice: itemTotal,
        });
      }

      totalSubtotal += vendorSubtotal;
      vendorOrdersData.push({
        id: randomUUID(),
        vendorId,
        subtotal: vendorSubtotal,
        commissionAmount: vendorSubtotal * COMMISSION_RATE,
        totalAmount: vendorSubtotal,
        items: vendorItemsData,
      });
    }
    return { totalSubtotal, vendorOrdersData };
  }

  private async createCustomerOrderRecord(dto: CreateOrderDto, totalSubtotal: number, connection: PoolConnection): Promise<CustomerOrder> {
    const deliveryFee = DELIVERY_FEE;
    const totalAmount = totalSubtotal + deliveryFee;

    const customerOrder: CustomerOrder = {
      id: randomUUID(),
      customerId: dto.customerId!,
      status: CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
      subtotal: totalSubtotal,
      deliveryFee,
      totalAmount,
      commissionAmount: totalSubtotal * COMMISSION_RATE,
      deliveryAddress: dto.deliveryAddress,
      deliveryLatitude: dto.deliveryLatitude,
      deliveryLongitude: dto.deliveryLongitude,
      customerNotes: dto.customerNotes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.customerOrderRepo.create(customerOrder, connection);
    await this.stateManager.recordStatusChange(
      { customerOrderId: customerOrder.id },
      CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
      undefined,
      connection
    );
    return created;
  }

  private async createVendorOrderRecords(customerOrder: CustomerOrder, vendorOrdersData: any[], userId: string | undefined, connection: PoolConnection) {
    const createdVendorOrders: (VendorOrder & { items: VendorOrderItem[] })[] = [];

    for (const voData of vendorOrdersData) {
      const vendorOrder: VendorOrder = {
        id: voData.id,
        customerOrderId: customerOrder.id,
        vendorId: voData.vendorId,
        status: VendorOrderStatus.PENDING,
        subtotal: voData.subtotal,
        commissionAmount: voData.commissionAmount,
        totalAmount: voData.totalAmount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.vendorOrderRepo.create(vendorOrder, connection);
      await this.stateManager.recordStatusChange({ vendorOrderId: vendorOrder.id }, VendorOrderStatus.PENDING, undefined, connection);

      const uniqueItems = this.mergeDuplicateItems(voData.items, vendorOrder.id);
      for (const item of uniqueItems) {
        await this.vendorOrderItemRepo.create(item, connection);
      }

      createdVendorOrders.push({ ...vendorOrder, items: uniqueItems });

      const vendorInfo = await this.vendorClient.getVendor(vendorOrder.vendorId, userId);
      await this.publisher.publishVendorOrderCreated({
        vendorOrderId: vendorOrder.id,
        vendorId: vendorOrder.vendorId,
        vendorUserId: vendorInfo?.userId,
        customerOrderId: customerOrder.id,
        customerId: customerOrder.customerId
      });
    }
    return createdVendorOrders;
  }

  private mergeDuplicateItems(items: VendorOrderItem[], vendorOrderId: string): VendorOrderItem[] {
    const mergedItems = new Map<string, VendorOrderItem>();
    for (const item of items) {
      const existing = mergedItems.get(item.vendorProductId);
      if (existing) {
        if (item.quantity !== undefined) existing.quantity! += item.quantity;
        if (item.requestedWeightGrams !== undefined) {
          existing.requestedWeightGrams! += item.requestedWeightGrams;
          existing.requestedWeight = existing.requestedWeightGrams! / 1000;
        }
        existing.totalPrice = Number(existing.totalPrice) + Number(item.totalPrice);
      } else {
        item.vendorOrderId = vendorOrderId;
        mergedItems.set(item.vendorProductId, { ...item });
      }
    }
    return Array.from(mergedItems.values());
  }

  private async handleStockOperations(dto: CreateOrderDto, productInfos: ProductInfo[], userId?: string) {
    for (const item of dto.items) {
      const product = productInfos.find(p => p?.id === item.vendorProductId);
      if (product?.measurementType === MeasurementType.UNIT) {
        await this.catalogClient.checkAndDecrementStock(item.vendorProductId, item.quantity!, userId, product.measurementType);
      } else if (product?.measurementType === MeasurementType.WEIGHT) {
        await this.catalogClient.reserveWeightStock(item.vendorProductId, item.weightGrams!, userId);
      }
    }
  }
}
