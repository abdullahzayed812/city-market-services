import { Logger, Database } from "@city-market/shared/node";
import { CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { OrderStateManager } from "../services/order-state.manager";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";

export class StockReservedConsumer {
  constructor(
    private db: Database,
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private stateManager: OrderStateManager,
    private publisher: OrderPublisher,
    private vendorClient: VendorHttpClient,
  ) {}

  async handle(event: any): Promise<void> {
    const { orderId } = event.payload;
    Logger.info(`[OrderService] Handling stock reserved for order ${orderId}`);

    const connection = await this.db.beginTransaction();
    try {
      const customerOrder = await this.customerOrderRepo.findByIdWithLock(orderId, connection);
      if (!customerOrder) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (customerOrder.status !== CustomerOrderStatus.DRAFT) {
        Logger.warn(`[OrderService] Order ${orderId} is not in DRAFT status, skipping StockReserved handling`);
        await connection.rollback();
        return;
      }

      // 1. Update Customer Order status
      await this.customerOrderRepo.updateStatus(orderId, CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION, connection);
      await this.stateManager.recordStatusChange(
        { customerOrderId: orderId },
        CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
        "Stock reserved successfully",
        connection,
      );

      // 2. Update Vendor Orders status
      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(orderId, connection);
      for (const vo of vendorOrders) {
        if (vo.status === VendorOrderStatus.DRAFT) {
          await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.PENDING, connection);
          await this.stateManager.recordStatusChange(
            { vendorOrderId: vo.id },
            VendorOrderStatus.PENDING,
            "Stock reserved successfully",
            connection,
          );

          // 3. Publish VENDOR_ORDER_CREATED event
          const vendorInfo = await this.vendorClient.getVendor(vo.vendorId);
          await this.publisher.publishVendorOrderCreated({
            vendorOrderId: vo.id,
            vendorId: vo.vendorId,
            vendorUserId: vendorInfo?.userId,
            customerOrderId: orderId,
            customerId: customerOrder.customerId,
          });
        }
      }

      await connection.commit();
      Logger.info(`[OrderService] Order ${orderId} moved to PENDING_VENDOR_CONFIRMATION`);
    } catch (error: any) {
      await connection.rollback();
      Logger.error(`[OrderService] Error handling stock reserved for order ${orderId}`, error);
    } finally {
      connection.release();
    }
  }
}
