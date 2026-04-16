import { CatalogService } from "../services/catalog.service";
import { Logger, rabbitMQBus } from "@city-market/shared/node";
import { EventType, MeasurementType } from "@city-market/shared";

export class OrderStockCheckConsumer {
  constructor(private catalogService: CatalogService) {}

  async handle(event: any): Promise<void> {
    const { orderId, items } = event.payload;
    Logger.info(`[CatalogService] Checking stock for order ${orderId}`);

    if (!items || items.length === 0) {
      Logger.warn(`[CatalogService] No items in order ${orderId} for stock check`);
      return;
    }

    const reservedItems: { productId: string; quantity: number; weightGrams: number }[] = [];
    let allReserved = true;

    try {
      for (const item of items) {
        const product = await this.catalogService.getVendorProductById(item.vendorProductId);
        
        let qty = 0;
        let weight = 0;
        
        if (product.measurementType === MeasurementType.UNIT) {
          qty = item.quantity || 0;
        } else {
          weight = item.weightGrams || Math.round((item.weight || 0) * 1000);
        }

        const success = await this.catalogService.reserveStock(item.vendorProductId, qty, weight);
        
        if (success) {
          reservedItems.push({ productId: item.vendorProductId, quantity: qty, weightGrams: weight });
        } else {
          Logger.warn(`[CatalogService] Stock reservation failed for product ${item.vendorProductId} in order ${orderId}`);
          allReserved = false;
          break;
        }
      }

      if (allReserved) {
        Logger.info(`[CatalogService] All items reserved for order ${orderId}`);
        await rabbitMQBus.publish({
          type: EventType.STOCK_RESERVED,
          payload: { orderId },
          createdAt: new Date(),
        });
      } else {
        // Rollback reservations
        Logger.info(`[CatalogService] Rolling back reservations for order ${orderId}`);
        for (const reserved of reservedItems) {
          await this.catalogService.releaseStock(reserved.productId, reserved.quantity, reserved.weightGrams);
        }
        
        await rabbitMQBus.publish({
          type: EventType.STOCK_REJECTED,
          payload: { orderId, reason: "insufficient_stock" },
          createdAt: new Date(),
        });
      }
    } catch (error: any) {
      Logger.error(`[CatalogService] Error during stock check for order ${orderId}`, error);
      
      // Rollback on unexpected error
      for (const reserved of reservedItems) {
        await this.catalogService.releaseStock(reserved.productId, reserved.quantity, reserved.weightGrams);
      }

      await rabbitMQBus.publish({
        type: EventType.STOCK_REJECTED,
        payload: { orderId, reason: error.message || "internal_error" },
        createdAt: new Date(),
      });
    }
  }
}
