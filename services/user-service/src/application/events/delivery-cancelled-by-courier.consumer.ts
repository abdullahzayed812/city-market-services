import { BaseEvent, EventSubscriber } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { UserService } from "../services/user.service";

export class DeliveryCancelledByCourierConsumer implements EventSubscriber {
  constructor(private userService: UserService) {}

  async handle(event: BaseEvent): Promise<void> {
    try {
      const { customerId, customerOrderId, deliveryId, reason } = event.payload;
      Logger.info(`Registering penalty for customer ${customerId} due to cancelled delivery ${deliveryId}`);
      await this.userService.registerPenalty({ customerId, customerOrderId, deliveryId, reason });
    } catch (error) {
      Logger.error(`Failed to process DELIVERY_CANCELLED_BY_COURIER for customer ${event.payload?.customerId}`, error);
    }
  }
}
