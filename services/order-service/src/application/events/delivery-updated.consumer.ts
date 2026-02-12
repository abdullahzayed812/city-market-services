import { BaseEvent, EventSubscriber, EventType, Logger, OrderStatus } from "@city-market/shared";
import { OrderService } from "../services/order.service";

export class DeliveryUpdatedConsumer implements EventSubscriber {
    constructor(private orderService: OrderService) { }

    async handle(event: BaseEvent): Promise<void> {
        try {
            const { customerOrderId, vendorOrderId } = event.payload;
            Logger.info(`Processing delivery update event ${event.type} for order ${customerOrderId || vendorOrderId}`);

            const statusMap: Partial<Record<EventType, OrderStatus>> = {
                [EventType.ORDER_PICKED_UP]: OrderStatus.PICKED_UP,
                [EventType.ORDER_ON_THE_WAY]: OrderStatus.ON_THE_WAY,
                [EventType.ORDER_DELIVERED]: OrderStatus.DELIVERED,
            };

            const status = statusMap[event.type];
            if (!status) return;

            if (vendorOrderId) {
                await this.orderService.updateVendorOrderStatus(vendorOrderId, status, `Delivery update: ${event.type}`);
            } else if (customerOrderId) {
                // If the event only has customerOrderId, we might need to update all associated vendor orders
                // but usually the event should have the specific target.
                // For now, let's assume if it's customer-level, we update the whole thing.
                // In my DeliveryService, I publish with customerOrderId.
                const orderData = await this.orderService.getOrderById(customerOrderId);
                for (const vo of orderData.vendorOrders) {
                    await this.orderService.updateVendorOrderStatus(vo.id, status, `Global delivery update: ${event.type}`);
                }
            }
        } catch (error) {
            Logger.error(`Failed to process event ${event.type} for order ${event.payload?.customerOrderId}`, error);
        }
    }
}
