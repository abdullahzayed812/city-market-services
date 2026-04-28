import { Logger, Database } from "@city-market/shared/node";
import { CustomerOrderStatus, EventType } from "@city-market/shared";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { OrderStateManager } from "../services/order-state.manager";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";

const CONFIRMATION_TIMEOUT_MINUTES = parseInt(process.env.ORDER_CONFIRMATION_TIMEOUT_MINUTES || "2", 10);

export class StockReservedConsumer {
  constructor(
    private db: Database,
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private stateManager: OrderStateManager,
    private publisher: OrderPublisher,
  ) {}

  async handle(event: any): Promise<void> {
    const { orderId } = event.payload;
    Logger.info(`[OrderService] Handling stock reserved for order ${orderId}`);

    await this.db.withTransaction(async (connection) => {
      const customerOrder = await this.customerOrderRepo.findByIdWithLock(orderId, connection);
      if (!customerOrder) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (customerOrder.status !== CustomerOrderStatus.DRAFT) {
        Logger.warn(`[OrderService] Order ${orderId} is not in DRAFT status, skipping StockReserved handling`);
        return;
      }

      const confirmationExpiry = new Date(Date.now() + CONFIRMATION_TIMEOUT_MINUTES * 60 * 1000);

      // Move customer order to AWAITING_CUSTOMER_CONFIRMATION and set expiry
      await this.customerOrderRepo.updateStatus(orderId, CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION, connection);
      await this.customerOrderRepo.update(orderId, { confirmationExpiry }, connection);
      await this.stateManager.recordStatusChange(
        { customerOrderId: orderId },
        CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION,
        "Stock reserved — awaiting customer confirmation",
        connection,
      );

      // Vendor orders remain in DRAFT until customer confirms
      // Notify the customer via WebSocket so they see the confirmation card
      await this.publisher.publishGenericEvent(EventType.ORDER_AWAITING_CUSTOMER_CONFIRMATION, {
        customerOrderId: orderId,
        customerId: customerOrder.customerId,
        confirmationExpiry,
      });

      Logger.info(`[OrderService] Order ${orderId} moved to AWAITING_CUSTOMER_CONFIRMATION (expires ${confirmationExpiry.toISOString()})`);
    });
  }
}
