import { Logger, Database } from "@city-market/shared/node";
import { CustomerOrderStatus, EventType, VendorOrderStatus } from "@city-market/shared";
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

      await this.customerOrderRepo.updateStatus(orderId, CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION, connection);

      await this.stateManager.recordStatusChange(
        { customerOrderId: orderId },
        CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
        "Stock reserved — awaiting customer confirmation",
        connection,
      );

      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(orderId, connection);
      const slaSchedules: Array<() => Promise<void>> = [];

      for (const vo of vendorOrders) {
        if (vo.status === VendorOrderStatus.DRAFT) {
          await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.PENDING, connection);
          await this.stateManager.recordStatusChange({ vendorOrderId: vo.id }, VendorOrderStatus.PENDING, "Customer confirmed order", connection);
          slaSchedules.push(() =>
            this.stateManager.scheduleVendorConfirmationSla(vo.id, vo.vendorId, orderId, customerOrder.customerId, vo.vendorUserId),
          );
        }
      }

      Logger.info(`[OrderService] Order ${orderId} moved to PENDING_VENDOR_CONFIRMATION and vendor orders to PENDING`);

      // Schedule SLAs after transaction commits
      for (const schedule of slaSchedules) {
        schedule().catch((err: any) => Logger.warn(`[SLA] Failed to schedule: ${err.message}`));
      }
    });
  }
}
