import { BaseEvent, EventType } from "@city-market/shared";
import { RabbitMQBus } from "@city-market/shared/node";
import { randomUUID } from "crypto";

export class VendorPublisher {
  constructor(private eventBus: RabbitMQBus) {}

  private async publish(type: EventType, payload: any): Promise<void> {
    const event: BaseEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date(),
      payload,
    };
    await this.eventBus.publish(event);
  }

  async publishVendorRegistered(vendorId: string, userId: string): Promise<void> {
    await this.publish(EventType.VENDOR_REGISTERED, { vendorId, userId });
  }
}
