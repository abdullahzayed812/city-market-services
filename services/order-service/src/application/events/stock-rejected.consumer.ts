import { Logger, Database } from "@city-market/shared/node";
import { CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { OrderStateManager } from "../services/order-state.manager";

export class StockRejectedConsumer {
  constructor(
    private db: Database,
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private stateManager: OrderStateManager,
  ) {}

  async handle(event: any): Promise<void> {
    const { orderId, reason } = event.payload;
    Logger.info(`[OrderService] Handling stock rejected for order ${orderId}, reason: ${reason}`);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      const customerOrder = await this.customerOrderRepo.findByIdWithLock(orderId, connection);
      if (!customerOrder) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (customerOrder.status !== CustomerOrderStatus.DRAFT) {
        Logger.warn(`[OrderService] Order ${orderId} is not in DRAFT status, skipping StockRejected handling`);
        await connection.rollback();
        return;
      }

      // 1. Update Customer Order status to CANCELLED
      await this.customerOrderRepo.updateStatus(orderId, CustomerOrderStatus.CANCELLED, connection);
      await this.stateManager.recordStatusChange(
        { customerOrderId: orderId },
        CustomerOrderStatus.CANCELLED,
        `Stock check failed: ${reason}`,
        connection,
      );

      // 2. Update Vendor Orders status to CANCELLED
      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(orderId, connection);
      for (const vo of vendorOrders) {
        if (vo.status === VendorOrderStatus.DRAFT) {
          await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.CANCELLED, connection);
          await this.stateManager.recordStatusChange(
            { vendorOrderId: vo.id },
            VendorOrderStatus.CANCELLED,
            `Stock check failed: ${reason}`,
            connection,
          );
        }
      }

      await connection.commit();
      Logger.info(`[OrderService] Order ${orderId} cancelled due to stock rejection`);
    } catch (error: any) {
      await connection.rollback();
      Logger.error(`[OrderService] Error handling stock rejected for order ${orderId}`, error);
    } finally {
      connection.release();
    }
  }
}
