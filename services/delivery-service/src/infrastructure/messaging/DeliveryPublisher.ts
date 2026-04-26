import { BaseEvent, EventType } from "@city-market/shared";
import { RabbitMQBus } from "@city-market/shared/node";
import { randomUUID } from "crypto";

export class DeliveryPublisher {
  constructor(private eventBus: RabbitMQBus) { }

  private async publish(type: EventType, payload: any): Promise<void> {
    const event: BaseEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date(),
      payload,
    };
    await this.eventBus.publish(event);
  }

  async publishDeliveryCreated(data: {
    deliveryId: string;
    customerId: string;
    customerOrderId: string;
  }): Promise<void> {
    await this.publish(EventType.DELIVERY_CREATED, data);
  }

  async publishOrderPickedUp(data: {
    deliveryId: string;
    customerOrderId: string;
    customerId: string;
    vendorOrdersIds?: string[];
  }): Promise<void> {
    await this.publish(EventType.ORDER_PICKED_UP, data);
  }

  async publishOrderOnTheWay(data: {
    deliveryId: string;
    customerOrderId: string;
    customerId: string;
    vendorOrdersIds?: string[];
  }): Promise<void> {
    await this.publish(EventType.ORDER_ON_THE_WAY, data);
  }

  async publishOrderDelivered(data: {
    deliveryId: string;
    customerOrderId: string;
    customerId: string;
    vendorOrdersIds?: string[];
    items?: any[];
  }): Promise<void> {
    await this.publish(EventType.ORDER_DELIVERED, data);
  }

  async publishCourierAssigned(data: {
    deliveryId: string;
    courierId: string;
    courierUserId: string;
    customerId: string;
    customerOrderId: string;
  }): Promise<void> {
    await this.publish(EventType.COURIER_ASSIGNED, data);
  }

  async publishDeliveryFailed(data: {
    deliveryId: string;
    customerOrderId: string;
    customerId: string;
  }): Promise<void> {
    await this.publish(EventType.DELIVERY_FAILED, data);
  }

  async publishDeliveryFailedByCourier(data: {
    deliveryId: string;
    customerOrderId: string;
    customerId: string;
    reason: string;
  }): Promise<void> {
    await this.publish(EventType.DELIVERY_CANCELLED_BY_COURIER, data);
  }
}
