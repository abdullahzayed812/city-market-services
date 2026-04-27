import { BaseEvent, EventSubscriber, EventType } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { DeliveryService } from "../services/delivery.service";

export class OrderReadyConsumer implements EventSubscriber {
  constructor(private deliveryService: DeliveryService) {}

  async handle(event: BaseEvent): Promise<void> {
    if (event.type !== EventType.ORDER_READY) {
      return;
    }

    try {
      const { customerOrderId, deliveryFee } = event.payload;
      Logger.info(`Processing ORDER_READY event for order ${customerOrderId}`);

      await this.deliveryService.createDeliveryFromOrder(customerOrderId, undefined, deliveryFee);
    } catch (error) {
      Logger.error(`Failed to process ORDER_READY event for order ${event.payload.customerOrderId}`, error);
    }
  }
}
