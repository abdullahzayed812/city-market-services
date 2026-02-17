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
      const { customerOrderId } = event.payload;
      Logger.info(`Processing ORDER_READY event for order ${customerOrderId}`);

      // Assuming the event payload might contain a token or we need a system token.
      // For now, passing undefined as the event structure doesn't seem to carry user token.
      // If the services require auth, we need a mechanism to get a token here.
      await this.deliveryService.createDeliveryFromOrder(customerOrderId);
    } catch (error) {
      Logger.error(`Failed to process ORDER_READY event for order ${event.payload.customerOrderId}`, error);
    }
  }
}
