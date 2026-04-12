import { CatalogService } from "../services/catalog.service.js";
import { EventType, MeasurementType } from "@city-market/shared";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

export class OrderDeliveredConsumer {
  constructor(private catalogService: CatalogService) {}

  async handle(event: any): Promise<void> {
    const { orderId, items } = event.payload;
    Logger.info(`[CatalogService] Handling order.created for order ${orderId}`);

    try {
      // Step 1: Attempt to reserve/decrement stock for all items
      // In a real production scenario, this should be done in a single transaction
      // For simplicity here, we iterate.
      for (const item of items) {
        const product = await this.catalogService.getVendorProductById(item.vendorProductId);

        await this.catalogService.decrementVendorStock(item.vendorProductId, item.quantity, product.measurementType);
      }

      // // Step 2: Success! Emit STOCK_RESERVED
      // await rabbitMQBus.publish({
      //   type: EventType.STOCK_RESERVED,
      //   payload: { orderId },
      //   timestamp: new Date(),
      //   metadata: {},
      // } as any);

      Logger.info(`Stock reserved successfully for order ${orderId}`);
    } catch (error: any) {
      Logger.error(`Stock reservation failed for order ${orderId}`, error);

      // Step 3: Failure! Emit STOCK_FAILED (to trigger order cancellation)
      // await rabbitMQBus.publish({
      //   type: EventType.STOCK_FAILED,
      //   payload: {
      //     orderId,
      //     reason: error.message || "insufficient_stock",
      //   },
      //   timestamp: new Date(),
      //   metadata: {},
      // } as any);
    }
  }
}
