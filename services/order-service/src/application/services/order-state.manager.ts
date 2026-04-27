import { PoolConnection } from "mysql2/promise";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { IOrderItemProposalRepository } from "../../core/interfaces/order-item-proposal.repository";
import { IOrderStatusHistoryRepository } from "../../core/interfaces/order-status-history.repository";
import { OrderStatusHistory } from "../../core/entities/order-status-history.entity";
import { CustomerOrderStatus, VendorOrderStatus, EventType, ProposalStatus } from "@city-market/shared";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";
import { randomUUID } from "crypto";

export class OrderStateManager {
  constructor(
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private proposalRepo: IOrderItemProposalRepository,
    private statusHistoryRepo: IOrderStatusHistoryRepository,
    private publisher: OrderPublisher,
  ) {}

  async recordStatusChange(
    ids: { customerOrderId?: string; vendorOrderId?: string },
    status: CustomerOrderStatus | VendorOrderStatus,
    notes?: string,
    connection?: PoolConnection,
  ): Promise<void> {
    const history: OrderStatusHistory = {
      id: randomUUID(),
      customerOrderId: ids.customerOrderId,
      vendorOrderId: ids.vendorOrderId,
      status,
      notes,
      createdAt: new Date(),
    };
    await this.statusHistoryRepo.create(history, connection);
  }

  async syncCustomerOrderStatus(customerOrderId: string, connection: PoolConnection): Promise<void> {
    const customerOrder = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
    if (!customerOrder) return;

    const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, connection);
    const deliveryStatuses = [VendorOrderStatus.PICKED_UP, VendorOrderStatus.ON_THE_WAY, VendorOrderStatus.DELIVERED];

    const nonCancelledVendorOrders = vendorOrders.filter((vo) => vo.status !== VendorOrderStatus.CANCELLED);

    // If any is in delivery flow, we don't sync back to READY or earlier via this method
    const allInDelivery = nonCancelledVendorOrders.every((vo) => deliveryStatuses.includes(vo.status));
    if (allInDelivery && nonCancelledVendorOrders.length > 0) return;

    const allConfirmed =
      nonCancelledVendorOrders.length > 0 &&
      nonCancelledVendorOrders.every((vo) => vo.status === VendorOrderStatus.CONFIRMED);
    const allCancelled =
      vendorOrders.length > 0 && vendorOrders.every((vo) => vo.status === VendorOrderStatus.CANCELLED);

    let newStatus: CustomerOrderStatus | null = null;
    if (allCancelled) newStatus = CustomerOrderStatus.CANCELLED;
    else if (allConfirmed) newStatus = CustomerOrderStatus.READY;
    else if (vendorOrders.some((vo) => vo.status === VendorOrderStatus.PROPOSAL_SENT))
      newStatus = CustomerOrderStatus.WAITING_CUSTOMER_DECISION;
    else if (vendorOrders.some((vo) => vo.status === VendorOrderStatus.PREPARING))
      newStatus = CustomerOrderStatus.PREPARING;
    else if (vendorOrders.some((vo) => vo.status === VendorOrderStatus.PENDING))
      newStatus = CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION;

    if (newStatus && newStatus !== customerOrder.status) {
      await this.customerOrderRepo.updateStatus(customerOrderId, newStatus, connection);
      await this.recordStatusChange({ customerOrderId }, newStatus, undefined, connection);

      const eventType = this.getEventTypeForCustomerStatus(newStatus);
      if (eventType) {
        const payload: Record<string, any> = {
          customerOrderId,
          status: newStatus,
          customerId: customerOrder.customerId,
        };
        if (newStatus === CustomerOrderStatus.READY) {
          payload.deliveryFee = customerOrder.deliveryFee;
        }
        await this.publisher.publishGenericEvent(eventType, payload);
      }
    }
  }

  async syncVendorOrderStatus(vendorOrderId: string, connection: PoolConnection): Promise<void> {
    const vendorOrder = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
    if (!vendorOrder || vendorOrder.status !== VendorOrderStatus.PROPOSAL_SENT) return;

    const proposals = await this.proposalRepo.findByVendorOrder(vendorOrderId, connection);
    if (proposals.length === 0) return;

    const allAccepted = proposals.every((p) => p.status === ProposalStatus.ACCEPTED);
    const allRejected = proposals.every((p) => p.status === ProposalStatus.REJECTED);
    const anyPending = proposals.some((p) => p.status === ProposalStatus.PENDING);

    let newStatus: VendorOrderStatus | null = null;
    if (allAccepted) newStatus = VendorOrderStatus.CONFIRMED;
    else if (allRejected) newStatus = VendorOrderStatus.CANCELLED;
    else if (!anyPending) newStatus = VendorOrderStatus.CONFIRMED;

    if (newStatus) {
      await this.vendorOrderRepo.updateStatus(vendorOrderId, newStatus, connection);
      await this.recordStatusChange({ vendorOrderId }, newStatus, `All proposals processed`, connection);

      const customerOrder = await this.customerOrderRepo.findById(vendorOrder.customerOrderId, connection);

      const eventType = this.getEventTypeForVendorStatus(newStatus);
      if (eventType) {
        await this.publisher.publishGenericEvent(eventType, {
          vendorOrderId,
          customerOrderId: vendorOrder.customerOrderId,
          vendorId: vendorOrder.vendorId,
          customerId: customerOrder?.customerId,
          status: newStatus,
        });
      }
    }
  }

  isValidVendorStatusTransition(currentStatus: VendorOrderStatus, newStatus: VendorOrderStatus): boolean {
    const transitions: Record<VendorOrderStatus, VendorOrderStatus[]> = {
      [VendorOrderStatus.DRAFT]: [VendorOrderStatus.PENDING, VendorOrderStatus.CANCELLED],
      [VendorOrderStatus.PENDING]: [
        VendorOrderStatus.PREPARING,
        VendorOrderStatus.PROPOSAL_SENT,
        VendorOrderStatus.CONFIRMED,
        VendorOrderStatus.CANCELLED,
      ],
      [VendorOrderStatus.PREPARING]: [
        VendorOrderStatus.PROPOSAL_SENT,
        VendorOrderStatus.CONFIRMED,
        VendorOrderStatus.CANCELLED,
      ],
      [VendorOrderStatus.PROPOSAL_SENT]: [VendorOrderStatus.CONFIRMED, VendorOrderStatus.CANCELLED],
      [VendorOrderStatus.CONFIRMED]: [VendorOrderStatus.PICKED_UP, VendorOrderStatus.CANCELLED],
      [VendorOrderStatus.PICKED_UP]: [VendorOrderStatus.ON_THE_WAY, VendorOrderStatus.CANCELLED],
      [VendorOrderStatus.ON_THE_WAY]: [VendorOrderStatus.DELIVERED, VendorOrderStatus.CANCELLED],
      [VendorOrderStatus.DELIVERED]: [],
      [VendorOrderStatus.CANCELLED]: [],
    };
    return transitions[currentStatus]?.includes(newStatus) || false;
  }

  isValidCustomerStatusTransition(currentStatus: CustomerOrderStatus, newStatus: CustomerOrderStatus): boolean {
    const transitions: Record<CustomerOrderStatus, CustomerOrderStatus[]> = {
      [CustomerOrderStatus.DRAFT]: [CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION]: [
        CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
        CustomerOrderStatus.CANCELLED_BY_CUSTOMER,
      ],
      [CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION]: [
        CustomerOrderStatus.PREPARING,
        CustomerOrderStatus.WAITING_CUSTOMER_DECISION,
        CustomerOrderStatus.READY,
        CustomerOrderStatus.CANCELLED,
      ],
      [CustomerOrderStatus.PREPARING]: [
        CustomerOrderStatus.WAITING_CUSTOMER_DECISION,
        CustomerOrderStatus.READY,
        CustomerOrderStatus.CANCELLED,
      ],
      [CustomerOrderStatus.WAITING_CUSTOMER_DECISION]: [CustomerOrderStatus.READY, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.READY]: [CustomerOrderStatus.PICKED_UP, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.PICKED_UP]: [CustomerOrderStatus.IN_DELIVERY, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.IN_DELIVERY]: [CustomerOrderStatus.COMPLETED, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.COMPLETED]: [],
      [CustomerOrderStatus.CANCELLED]: [],
      [CustomerOrderStatus.CANCELLED_BY_CUSTOMER]: [],
    };
    return transitions[currentStatus]?.includes(newStatus) || false;
  }

  private getEventTypeForCustomerStatus(status: CustomerOrderStatus): EventType | null {
    const mapping: Partial<Record<CustomerOrderStatus, EventType>> = {
      [CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION]: EventType.ORDER_AWAITING_CUSTOMER_CONFIRMATION,
      [CustomerOrderStatus.PREPARING]: EventType.ORDER_PREPARING,
      [CustomerOrderStatus.READY]: EventType.ORDER_READY,
      [CustomerOrderStatus.IN_DELIVERY]: EventType.ORDER_ON_THE_WAY,
      [CustomerOrderStatus.COMPLETED]: EventType.ORDER_DELIVERED,
      [CustomerOrderStatus.CANCELLED]: EventType.ORDER_CANCELLED,
      [CustomerOrderStatus.CANCELLED_BY_CUSTOMER]: EventType.ORDER_CANCELLED,
    };
    return mapping[status] || null;
  }

  private getEventTypeForVendorStatus(status: VendorOrderStatus): EventType | null {
    const mapping: Partial<Record<VendorOrderStatus, EventType>> = {
      [VendorOrderStatus.CONFIRMED]: EventType.VENDOR_ORDER_CONFIRMED,
      [VendorOrderStatus.PICKED_UP]: EventType.ORDER_PICKED_UP,
      [VendorOrderStatus.ON_THE_WAY]: EventType.ORDER_ON_THE_WAY,
      [VendorOrderStatus.DELIVERED]: EventType.ORDER_DELIVERED,
      [VendorOrderStatus.CANCELLED]: EventType.VENDOR_ORDER_CANCELLED,
    };
    return mapping[status] || null;
  }
}
