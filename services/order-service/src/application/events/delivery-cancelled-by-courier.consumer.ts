import { BaseEvent, EventSubscriber } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { OrderService } from "../services/order.service";

export class DeliveryCancelledByCourierConsumer implements EventSubscriber {
  constructor(private orderService: OrderService) {}

  async handle(event: BaseEvent): Promise<void> {
    try {
      const { customerOrderId } = event.payload;
      Logger.info(`Processing DELIVERY_CANCELLED_BY_COURIER for order ${customerOrderId}`);
      await this.orderService.cancelOrderDueToDeliveryFailure(customerOrderId);
    } catch (error) {
      Logger.error(`Failed to process DELIVERY_CANCELLED_BY_COURIER for order ${event.payload?.customerOrderId}`, error);
    }
  }
}
