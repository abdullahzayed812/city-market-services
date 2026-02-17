import { BaseEvent, EventSubscriber, EventType, CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { OrderHttpClient } from "../../infrastructure/http/order-http-client";

export class DeliveryStatusConsumer implements EventSubscriber {
  constructor(private orderHttpClient: OrderHttpClient) {}

  async handle(event: BaseEvent): Promise<void> {
    // These events are typically emitted by the delivery service itself or a courier service.
    // Assuming the payload contains the necessary IDs.
    const { customerOrderId, vendorOrderId } = event.payload; 

    if (!customerOrderId && !vendorOrderId) { // At least one ID is required
      Logger.warn(`Delivery status event ${event.type} received without customerOrderId or vendorOrderId. Payload: ${JSON.stringify(event.payload)}`);
      return;
    }

    let newCustomerOrderStatus: CustomerOrderStatus | null = null;
    let newVendorOrderStatus: VendorOrderStatus | null = null;

    switch (event.type) {
      case EventType.ORDER_PICKED_UP:
        newVendorOrderStatus = VendorOrderStatus.PICKED_UP;
        // When any vendor order is picked up, the customer order moves to IN_DELIVERY
        newCustomerOrderStatus = CustomerOrderStatus.IN_DELIVERY; 
        break;
      case EventType.ORDER_ON_THE_WAY:
        newVendorOrderStatus = VendorOrderStatus.ON_THE_WAY;
        newCustomerOrderStatus = CustomerOrderStatus.IN_DELIVERY; // Ensure customer order is IN_DELIVERY
        break;
      case EventType.ORDER_DELIVERED:
        newVendorOrderStatus = VendorOrderStatus.DELIVERED;
        newCustomerOrderStatus = CustomerOrderStatus.COMPLETED;
        break;
      default:
        return; // Ignore other events
    }

    try {
      if (newVendorOrderStatus && vendorOrderId) {
        await this.orderHttpClient.updateVendorOrderStatus(vendorOrderId, newVendorOrderStatus);
        Logger.info(`Updated vendor order ${vendorOrderId} to status ${newVendorOrderStatus} from event ${event.type}`);
      }
      if (newCustomerOrderStatus && customerOrderId) {
        await this.orderHttpClient.updateCustomerOrderStatus(customerOrderId, newCustomerOrderStatus);
        Logger.info(`Updated customer order ${customerOrderId} to status ${newCustomerOrderStatus} from event ${event.type}`);
      }
    } catch (error) {
      Logger.error(`Failed to update order statuses for customer ${customerOrderId} / vendor ${vendorOrderId} from event ${event.type}`, error);
    }
  }
}
