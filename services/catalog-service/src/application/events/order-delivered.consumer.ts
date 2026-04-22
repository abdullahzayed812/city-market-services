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
        let actualWeight = 0;
        let reservedWeight = 0;

        if (product.measurementType === MeasurementType.UNIT) {
          qty = item.quantity || 0;
        } else {
          reservedWeight = item.requestedWeightGrams || 0;
          actualWeight = item.actualWeightGrams || reservedWeight || Math.round((item.weight || 0) * 1000);
          
          // If for some reason reservedWeight is still 0 but we have actual weight, 
          // we should still use actual weight for stock deduction, but reserved decrement will be 0
        }

        if (qty > 0 || actualWeight > 0 || reservedWeight > 0) {
          await this.catalogService.commitStock(item.vendorProductId, qty, actualWeight, reservedWeight);
        }
      }

      Logger.info(`Stock committed successfully for order ${customerOrderId}`);
    } catch (error: any) {
      Logger.error(`Stock commit failed for order ${customerOrderId}`, error);
    }
  }
}
