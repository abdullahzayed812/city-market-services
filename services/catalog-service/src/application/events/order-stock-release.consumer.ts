import { CatalogService } from "../services/catalog.service";
import { Logger } from "@city-market/shared/node";

export class OrderStockReleaseConsumer {
  constructor(private catalogService: CatalogService) {}

  async handle(event: any): Promise<void> {
    const { orderId, items } = event.payload;
    Logger.info(`[CatalogService] Releasing stock for order ${orderId}`);

    if (!items || items.length === 0) {
      Logger.warn(`[CatalogService] No items in stock release payload for order ${orderId}`);
      return;
    }

    for (const item of items) {
      try {
        await this.catalogService.releaseStock(item.vendorProductId, item.quantity, item.weightGrams);
      } catch (error) {
        Logger.error(`[CatalogService] Failed to release stock for product ${item.vendorProductId} (order ${orderId})`, error);
      }
    }
  }
}
