import { CatalogService } from "../services/catalog.service.js";
import { Logger } from "@city-market/shared/node";
import { MeasurementType } from "@city-market/shared";

export class OrderDeliveredConsumer {
  constructor(private catalogService: CatalogService) {}

  async handle(event: any): Promise<void> {
    const { customerOrderId, items } = event.payload;
    Logger.info(`[CatalogService] Handling order.delivered for order ${customerOrderId}`);

    if (!items || items.length === 0) {
      Logger.warn(`[CatalogService] No items found in payload for order ${customerOrderId}`);
      return;
    }

    try {
      // Step 1: Commit stock for all items (subtract stock and reserved)
      for (const item of items) {
        const product = await this.catalogService.getVendorProductById(item.vendorProductId);

        // Deduct based on quantity or weight
        let qty = 0;
        let weight = 0;

        if (product.measurementType === MeasurementType.UNIT) {
          qty = item.quantity || 0;
        } else {
          weight = item.actualWeightGrams || item.requestedWeightGrams || Math.round((item.weight || 0) * 1000);
        }

        if (qty > 0 || weight > 0) {
          await this.catalogService.commitStock(item.vendorProductId, qty, weight);
        }
      }

      Logger.info(`Stock committed successfully for order ${customerOrderId}`);
    } catch (error: any) {
      Logger.error(`Stock commit failed for order ${customerOrderId}`, error);
    }
  }
}
