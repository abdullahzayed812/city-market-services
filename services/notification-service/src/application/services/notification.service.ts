import { EventBus, BaseEvent, EventType, EventSubscriber } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";

export class NotificationService implements EventSubscriber {
  constructor(private eventBus: EventBus) {
    // Subscribe to all events
    Object.values(EventType).forEach((eventType) => {
      this.eventBus.subscribe(eventType as EventType, this);
    });
  }

  async handle(event: BaseEvent): Promise<void> {
    Logger.info(`[NOTIFICATION] Event received: ${event.type}`, event.payload);

    switch (event.type) {
      case EventType.ORDER_CREATED:
        await this.notifyOrderCreated(event.payload);
        break;
      case EventType.ORDER_CONFIRMED:
        await this.notifyOrderConfirmed(event.payload);
        break;
      case EventType.ORDER_READY:
        await this.notifyOrderReady(event.payload);
        break;
      case EventType.COURIER_ASSIGNED:
        await this.notifyCourierAssigned(event.payload);
        break;
      case EventType.ORDER_DELIVERED:
        await this.notifyOrderDelivered(event.payload);
        break;
      case EventType.ORDER_CANCELLED:
        await this.notifyOrderCancelled(event.payload);
        break;
      default:
        Logger.info(`[NOTIFICATION] Unhandled event type: ${event.type}`);
    }
  }

  private async notifyOrderCreated(payload: any): Promise<void> {
    Logger.info(`📦 New order created! Order ID: ${payload.orderId}`);
    Logger.info(`   Customer: ${payload.customerId}, Vendor: ${payload.vendorId}`);
  }

  private async notifyOrderConfirmed(payload: any): Promise<void> {
    Logger.info(`✅ Order confirmed! Order ID: ${payload.orderId}`);
  }

  private async notifyOrderReady(payload: any): Promise<void> {
    Logger.info(`🍽️ Order ready for pickup! Order ID: ${payload.orderId}`);
  }

  private async notifyCourierAssigned(payload: any): Promise<void> {
    Logger.info(`🚗 Courier assigned! Order ID: ${payload.orderId}, Courier: ${payload.courierId}`);
  }

  private async notifyOrderDelivered(payload: any): Promise<void> {
    Logger.info(`✨ Order delivered! Order ID: ${payload.orderId}`);
  }

  private async notifyOrderCancelled(payload: any): Promise<void> {
    Logger.info(`❌ Order cancelled! Order ID: ${payload.orderId}, Reason: ${payload.reason}`);
  }
}
