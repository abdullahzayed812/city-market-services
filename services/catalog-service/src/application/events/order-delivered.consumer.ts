import { CatalogService } from "../services/catalog.service.js";
import { Logger } from "@city-market/shared/node";

export class OrderDeliveredConsumer {
  constructor(private catalogService: CatalogService) { }

  async handle(event: any): Promise<void> {
    const { customerOrderId, items } = event.payload;
    Logger.info(`[CatalogService] Handling order.delivered for order ${customerOrderId}`);

    if (!items || items.length === 0) {
      Logger.warn(`[CatalogService] No items found in payload for order ${customerOrderId}`);
      return;
    }

    try {
      // Step 1: Decrement stock for all items
      for (const item of items) {
        const product = await this.catalogService.getVendorProductById(item.vendorProductId);

        // Deduct based on quantity or weight
        const amount = item.actualWeightGrams || item.quantity || 0;
        if (amount > 0) {
          await this.catalogService.decrementVendorStock(item.vendorProductId, amount, product.measurementType);
        }
      }

      Logger.info(`Stock decremented successfully for order ${customerOrderId}`);
    } catch (error: any) {
      Logger.error(`Stock decremented failed for order ${customerOrderId}`, error);
    }
  }
}
