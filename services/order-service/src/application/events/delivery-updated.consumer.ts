import { BaseEvent, EventSubscriber, EventType, CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { OrderService } from "../services/order.service";

export class DeliveryUpdatedConsumer implements EventSubscriber {
  constructor(private orderService: OrderService) {}

  async handle(event: BaseEvent): Promise<void> {
    try {
      const { customerOrderId, vendorOrderId } = event.payload;
      Logger.info(`Processing delivery update event ${event.type} for order ${customerOrderId || vendorOrderId}`);

      const customerStatusMap: Partial<Record<EventType, CustomerOrderStatus>> = {
        [EventType.ORDER_PICKED_UP]: CustomerOrderStatus.PICKED_UP,
        [EventType.ORDER_ON_THE_WAY]: CustomerOrderStatus.IN_DELIVERY,
        [EventType.ORDER_DELIVERED]: CustomerOrderStatus.COMPLETED,
      };

      const vendorStatusMap: Partial<Record<EventType, VendorOrderStatus>> = {
        [EventType.ORDER_PICKED_UP]: VendorOrderStatus.PICKED_UP,
        [EventType.ORDER_ON_THE_WAY]: VendorOrderStatus.ON_THE_WAY,
        [EventType.ORDER_DELIVERED]: VendorOrderStatus.DELIVERED,
      };

      // Handle Customer Order Status
      const customerStatus = customerStatusMap[event.type as keyof typeof customerStatusMap];
      if (customerOrderId && customerStatus) {
        await this.orderService.updateCustomerOrderStatus(
          customerOrderId,
          customerStatus,
          `Delivery update: ${event.type}`
        );
      }

      // Handle Vendor Order Status
      const vendorStatus = vendorStatusMap[event.type as keyof typeof vendorStatusMap];
      if (vendorOrderId && vendorStatus) {
        await this.orderService.updateVendorOrderStatus(vendorOrderId, vendorStatus, `Delivery update: ${event.type}`);
      }

      if (!customerOrderId && !vendorOrderId) {
        Logger.warn(`Delivery event ${event.type} received without customerOrderId or vendorOrderId.`);
      }
    } catch (error) {
      Logger.error(`Failed to process event ${event.type} for order ${event.payload?.customerOrderId}`, error);
    }
  }
}
