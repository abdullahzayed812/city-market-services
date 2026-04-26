import { BaseEvent, EventSubscriber, EventType, CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { OrderService } from "../services/order.service";

export class DeliveryUpdatedConsumer implements EventSubscriber {
  constructor(private orderService: OrderService) {}

  async handle(event: BaseEvent): Promise<void> {
    try {
      const { customerOrderId, vendorOrdersIds } = event.payload;
      Logger.info(`Processing delivery update event ${event.type} for order ${customerOrderId}`);

      if (event.type === EventType.DELIVERY_FAILED) {
        if (customerOrderId) {
          await this.orderService.cancelOrderDueToDeliveryFailure(customerOrderId);
        }
        return;
      }

      if (!customerOrderId && !vendorOrdersIds.length) {
        Logger.warn(`Delivery event ${event.type} received without customerOrderId or vendorOrderId.`);
      }

      const vendorStatusMap: Partial<Record<EventType, VendorOrderStatus>> = {
        [EventType.ORDER_PICKED_UP]: VendorOrderStatus.PICKED_UP,
        [EventType.ORDER_ON_THE_WAY]: VendorOrderStatus.ON_THE_WAY,
        [EventType.ORDER_DELIVERED]: VendorOrderStatus.DELIVERED,
      };

      const customerStatusMap: Partial<Record<EventType, CustomerOrderStatus>> = {
        [EventType.ORDER_PICKED_UP]: CustomerOrderStatus.PICKED_UP,
        [EventType.ORDER_ON_THE_WAY]: CustomerOrderStatus.IN_DELIVERY,
        [EventType.ORDER_DELIVERED]: CustomerOrderStatus.COMPLETED,
      };

      // Handle Vendor Order Status
      const vendorStatus = vendorStatusMap[event.type as keyof typeof vendorStatusMap];
      if (vendorOrdersIds?.length && vendorStatus) {
        for (const id of vendorOrdersIds)
          await this.orderService.updateVendorOrderStatus(id, vendorStatus, `Delivery update: ${event.type}`, true);
      }

      // Handle Customer Order Status
      const customerStatus = customerStatusMap[event.type as keyof typeof customerStatusMap];
      if (customerOrderId && customerStatus) {
        await this.orderService.updateCustomerOrderStatus(
          customerOrderId,
          customerStatus,
          `Delivery update: ${event.type}`
        );
      }
    } catch (error) {
      Logger.error(`Failed to process event ${event.type} for order ${event.payload?.customerOrderId}`, error);
    }
  }
}
