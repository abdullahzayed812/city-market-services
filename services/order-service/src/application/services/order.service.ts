import { PoolConnection } from "mysql2/promise";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { IOrderItemProposalRepository } from "../../core/interfaces/order-item-proposal.repository";
import { IOrderStatusHistoryRepository } from "../../core/interfaces/order-status-history.repository";
import { CustomerOrder } from "../../core/entities/customer-order.entity";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { VendorOrderItem } from "../../core/entities/vendor-order-item.entity";
import { OrderItemProposal } from "../../core/entities/order-item-proposal.entity";
import { CreateOrderDto, ProposeChangesDto, OrderWithItems } from "../../core/dto/order.dto";
import {
  CustomerOrderStatus,
  VendorOrderStatus,
  ValidationError,
  NotFoundError,
  ProposalStatus,
  EventType,
} from "@city-market/shared";
import { Database, Logger } from "@city-market/shared/node";
import { CatalogHttpClient } from "../../infrastructure/http/catalog-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";
import { UserHttpClient } from "../../infrastructure/http/user-http-client";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";

// Sub-services/Managers
import { OrderStateManager } from "./order-state.manager";
import { OrderCreationManager } from "./order-creation.manager";
import { ProposalManager } from "./proposal.manager";
import { VendorOrderManager } from "./vendor-order.manager";
import { OrderMapper } from "../mappers/order.mapper";
import { CommissionTierService } from "./commission-tier.service";
import { DeliveryFeeCalculator } from "../utils/DeliveryFeeCalculator";

export class OrderService {
  public stateManager: OrderStateManager;
  private creationManager: OrderCreationManager;
  private proposalManager: ProposalManager;
  private vendorOrderManager: VendorOrderManager;

  constructor(
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private vendorOrderItemRepo: IVendorOrderItemRepository,
    private proposalRepo: IOrderItemProposalRepository,
    private statusHistoryRepo: IOrderStatusHistoryRepository,
    private catalogClient: CatalogHttpClient,
    private vendorClient: VendorHttpClient,
    private publisher: OrderPublisher,
    private commissionTierService: CommissionTierService,
    private db: Database,
    private userClient: UserHttpClient,
  ) {
    this.stateManager = new OrderStateManager(
      customerOrderRepo,
      vendorOrderRepo,
      proposalRepo,
      statusHistoryRepo,
      publisher,
    );
    this.proposalManager = new ProposalManager(
      customerOrderRepo,
      vendorOrderRepo,
      vendorOrderItemRepo,
      proposalRepo,
      catalogClient,
      vendorClient,
      publisher,
      this.stateManager,
      this.commissionTierService,
    );
    this.creationManager = new OrderCreationManager(
      customerOrderRepo,
      vendorOrderRepo,
      vendorOrderItemRepo,
      catalogClient,
      vendorClient,
      publisher,
      this.stateManager,
      this.commissionTierService,
    );
    this.vendorOrderManager = new VendorOrderManager(
      vendorOrderRepo,
      vendorOrderItemRepo,
      this.stateManager,
      this.proposalManager,
    );
  }

  async createOrder(dto: CreateOrderDto, userId?: string): Promise<OrderWithItems> {
    if (userId) {
      const hasPenalty = await this.userClient.hasActivePenalty(userId);
      if (hasPenalty) throw new ValidationError("cod_blocked_due_to_penalty");
    }

    return this.db.withTransaction(async (connection) => {
      const result = await this.creationManager.create(dto, userId, connection);
      return OrderMapper.mapOrderWithItems(result.order, result.vendorOrders);
    });
  }

  async getCustomerOrderById(id: string, userId?: string): Promise<OrderWithItems> {
    const customerOrder = await this.customerOrderRepo.findById(id);
    if (!customerOrder) throw new NotFoundError("order_not_found");

    const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(id);
    const uniqueVendorIds = Array.from(new Set(vendorOrders.map((vo) => vo.vendorId)));
    const vendorDetailsArray = await Promise.all(
      uniqueVendorIds.map((vid) => this.vendorClient.getVendor(vid, userId)),
    );
    const vendorMap = new Map(uniqueVendorIds.map((vid, i) => [vid, vendorDetailsArray[i]]));

    const vendorOrdersWithItems = await Promise.all(
      vendorOrders.map(async (vo) => {
        const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id);
        const vendor = vendorMap.get(vo.vendorId);
        // const proposals = await this.proposalRepo.findByVendorOrder(vo.id);
        return {
          ...vo,
          vendorName: vendor?.shopName || "Unknown Vendor",
          vendorUserId: vendor?.userId,
          items,
          // proposals: [], // No proposals in response
        };
      }),
    );

    return OrderMapper.mapOrderWithItems(customerOrder, vendorOrdersWithItems);
  }

  async getCustomerOrders(customerId: string, page: number = 1, limit: number = 20): Promise<CustomerOrder[]> {
    const offset = (page - 1) * limit;
    const orders = await this.customerOrderRepo.findByCustomer(customerId, limit, offset);
    return orders.map((o) => OrderMapper.mapCustomerOrder(o));
  }

  async getAllOrders(page: number = 1, limit: number = 20): Promise<CustomerOrder[]> {
    const offset = (page - 1) * limit;
    const orders = await this.customerOrderRepo.findAll(limit, offset);
    return orders.map((o) => OrderMapper.mapCustomerOrder(o));
  }

  async getOrderProposals(orderId: string): Promise<OrderItemProposal[]> {
    const proposals = await this.proposalRepo.findByCustomerOrder(orderId);

    // Enrich with vendor shop names
    const uniqueVendorIds = Array.from(new Set(proposals.map((p) => p.vendorId).filter(Boolean) as string[]));
    const vendorDetailsArray = await Promise.all(uniqueVendorIds.map((vid) => this.vendorClient.getVendor(vid)));
    const vendorMap = new Map(uniqueVendorIds.map((vid, i) => [vid, vendorDetailsArray[i]]));

    return proposals
      .filter((p) => p.status === ProposalStatus.PENDING)
      .map((p) => {
        const vendor = p.vendorId ? vendorMap.get(p.vendorId) : null;
        return OrderMapper.mapProposal({
          ...p,
          vendorName: vendor?.shopName || "Unknown Vendor",
        });
      });
  }

  async getVendorOrders(
    vendorId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<(VendorOrder & { items: VendorOrderItem[] })[]> {
    const offset = (page - 1) * limit;
    const orders = await this.vendorOrderRepo.findByVendorWithItems(vendorId, limit, offset);
    return orders.map((vo) => OrderMapper.mapVendorOrderWithItems(vo));
  }

  async getVendorFinancials(vendorId: string, periodStart?: Date, periodEnd?: Date) {
    return this.vendorOrderRepo.getVendorFinancials(vendorId, periodStart, periodEnd);
  }

  async getVendorOrderById(
    id: string,
    userId?: string,
  ): Promise<VendorOrder & { items: VendorOrderItem[]; vendorName: string; proposals: OrderItemProposal[] }> {
    const vo = await this.vendorOrderRepo.findById(id);
    if (!vo) throw new NotFoundError("vendor_order_not_found");
    const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id);
    const vendor = await this.vendorClient.getVendor(vo.vendorId, userId);
    const proposals = await this.proposalRepo.findByVendorOrder(vo.id);

    const mappedVo = OrderMapper.mapVendorOrder(vo);
    const mappedItems = items.map((i) => OrderMapper.mapVendorOrderItem(i));
    const mappedProposals = proposals
      .filter((p) => p.status === ProposalStatus.PENDING)
      .map((p) => OrderMapper.mapProposal(p));

    return {
      ...mappedVo,
      vendorName: vendor?.shopName || "Unknown Vendor",
      items: mappedItems,
      proposals: mappedProposals,
    };
  }
  async proposeChanges(vendorOrderId: string, dto: ProposeChangesDto[]): Promise<void> {
    return this.db.withTransaction(async (connection) => {
      await this.proposalManager.propose(vendorOrderId, dto, connection);
    });
  }

  async acceptVendorOrder(vendorOrderId: string): Promise<void> {
    return this.db.withTransaction(async (connection) => {
      // 1. Fetch vendor order without lock to get the parent customerOrderId
      const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("vendor_order_not_found");

      // 2. Lock Parent (CustomerOrder) FIRST
      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) throw new NotFoundError("customer_order_not_found");

      // 3. Lock Child (VendorOrder) SECOND
      const lockedVo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!lockedVo) throw new NotFoundError("vendor_order_not_found");

      if (lockedVo.status !== VendorOrderStatus.PENDING)
        throw new ValidationError("vendor_can_only_confirm_pending_orders");

      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.PREPARING, connection);
      await this.stateManager.recordStatusChange({ vendorOrderId }, VendorOrderStatus.PREPARING, undefined, connection);

      await this.publisher.publishVendorOrderConfirmed({
        vendorOrderId,
        customerOrderId: lockedVo.customerOrderId,
        vendorId: lockedVo.vendorId,
        customerId: co.customerId,
      });

      await this.stateManager.syncCustomerOrderStatus(lockedVo.customerOrderId, connection);
    });
  }

  async updateVendorOrderStatus(
    vendorOrderId: string,
    status: VendorOrderStatus,
    notes?: string,
    skipCustomerSync: boolean = false,
  ): Promise<void> {
    return this.db.withTransaction(async (connection: PoolConnection) => {
      if (!skipCustomerSync) {
        const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
        if (vo) {
          await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
        }
      }
      await this.vendorOrderManager.updateStatus(vendorOrderId, status, notes, skipCustomerSync, connection);
    });
  }

  async acceptProposal(proposalId: string): Promise<void> {
    return this.db.withTransaction(async (connection: PoolConnection) => {
      await this.proposalManager.accept(proposalId, connection);
    });
  }

  async rejectProposal(proposalId: string, cancelEntireOrder: boolean = false): Promise<void> {
    return this.db.withTransaction(async (connection: PoolConnection) => {
      await this.proposalManager.reject(proposalId, cancelEntireOrder, connection);
    });
  }

  async updateCustomerOrderStatus(customerOrderId: string, status: CustomerOrderStatus, notes?: string): Promise<void> {
    return this.db.withTransaction(async (connection: PoolConnection) => {
      const co = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
      if (!co) throw new NotFoundError("customer_order_not_found");

      if (co.status === status) return;

      if (!this.stateManager.isValidCustomerStatusTransition(co.status, status))
        throw new ValidationError("invalid_customer_order_status_transition");

      await this.customerOrderRepo.updateStatus(customerOrderId, status, connection);
      await this.stateManager.recordStatusChange({ customerOrderId }, status, notes, connection);

      if (status === CustomerOrderStatus.COMPLETED) {
        const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, connection);
        const allItems: any[] = [];

        for (const vo of vendorOrders) {
          const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection);
          for (const item of items) {
            allItems.push({
              vendorProductId: item.vendorProductId,
              quantity: item.quantity,
              requestedWeightGrams: item.requestedWeightGrams,
              actualWeightGrams: item.actualWeightGrams,
              vendorId: vo.vendorId,
            });
          }
        }

        await this.publisher.publishGenericEvent(EventType.ORDER_DELIVERED, {
          customerOrderId,
          customerId: co.customerId,
          items: allItems,
        });
      }
    });
  }

  async confirmOrder(orderId: string, customerId: string): Promise<void> {
    return this.db.withTransaction(async (connection) => {
      const co = await this.customerOrderRepo.findByIdWithLock(orderId, connection);
      if (!co) throw new NotFoundError("order_not_found");
      if (co.customerId !== customerId) throw new ValidationError("not_authorized");
      if (co.status !== CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION)
        throw new ValidationError("order_not_awaiting_confirmation");
      if (co.confirmationExpiry && co.confirmationExpiry < new Date())
        throw new ValidationError("order_confirmation_expired");

      await this.customerOrderRepo.updateStatus(orderId, CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION, connection);
      await this.stateManager.recordStatusChange(
        { customerOrderId: orderId },
        CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
        "Confirmed by customer",
        connection,
      );

      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(orderId, connection);
      for (const vo of vendorOrders) {
        if (vo.status === VendorOrderStatus.DRAFT) {
          await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.PENDING, connection);
          await this.stateManager.recordStatusChange(
            { vendorOrderId: vo.id },
            VendorOrderStatus.PENDING,
            "Customer confirmed order",
            connection,
          );
          const vendorInfo = await this.vendorClient.getVendor(vo.vendorId);
          await this.publisher.publishVendorOrderCreated({
            vendorOrderId: vo.id,
            vendorId: vo.vendorId,
            vendorUserId: vendorInfo?.userId,
            customerOrderId: orderId,
            customerId: co.customerId,
          });
        }
      }
    });
  }

  async cancelOrderByCustomer(orderId: string, customerId: string): Promise<void> {
    return this.db.withTransaction(async (connection) => {
      const co = await this.customerOrderRepo.findByIdWithLock(orderId, connection);
      if (!co) throw new NotFoundError("order_not_found");
      if (co.customerId !== customerId) throw new ValidationError("not_authorized");
      if (co.status !== CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION)
        throw new ValidationError("order_not_awaiting_confirmation");

      await this._cancelAwaitingOrder(orderId, co.customerId, "Cancelled by customer", connection);
    });
  }

  async cancelExpiredOrders(): Promise<void> {
    const expired = await this.customerOrderRepo.findExpiredAwaitingConfirmation();
    for (const co of expired) {
      try {
        await this.db.withTransaction(async (connection) => {
          const locked = await this.customerOrderRepo.findByIdWithLock(co.id, connection);
          if (!locked || locked.status !== CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION) return;
          await this._cancelAwaitingOrder(co.id, co.customerId, "Confirmation timeout", connection);
        });
      } catch (err: any) {
        Logger.warn(`[OrderService] Failed to expire order ${co.id}: ${err.message}`);
      }
    }
  }

  private async _cancelAwaitingOrder(orderId: string, customerId: string, reason: string, connection: any): Promise<void> {
    await this.customerOrderRepo.updateStatus(orderId, CustomerOrderStatus.CANCELLED_BY_CUSTOMER, connection);
    await this.customerOrderRepo.update(orderId, { cancellationReason: reason }, connection);
    await this.stateManager.recordStatusChange(
      { customerOrderId: orderId },
      CustomerOrderStatus.CANCELLED_BY_CUSTOMER,
      reason,
      connection,
    );

    const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(orderId, connection);
    const items: any[] = [];
    for (const vo of vendorOrders) {
      if (vo.status === VendorOrderStatus.DRAFT) {
        await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.CANCELLED, connection);
        await this.stateManager.recordStatusChange(
          { vendorOrderId: vo.id },
          VendorOrderStatus.CANCELLED,
          reason,
          connection,
        );
      }
      const voItems = await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection);
      for (const item of voItems) {
        items.push({
          vendorProductId: item.vendorProductId,
          quantity: item.quantity,
          requestedWeightGrams: item.requestedWeightGrams,
          vendorId: vo.vendorId,
        });
      }
    }

    await this.publisher.publishOrderStockReleaseRequested({ orderId, items });
    await this.publisher.publishOrderCancelled(orderId, customerId);
  }

  async cancelOrderDueToDeliveryFailure(customerOrderId: string): Promise<void> {
    return this.db.withTransaction(async (connection) => {
      const co = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
      if (!co) return;

      const terminalStatuses: CustomerOrderStatus[] = [
        CustomerOrderStatus.COMPLETED,
        CustomerOrderStatus.CANCELLED,
        CustomerOrderStatus.CANCELLED_BY_CUSTOMER,
      ];
      if (terminalStatuses.includes(co.status)) return;

      const reason = "Delivery assignment expired";
      await this.customerOrderRepo.updateStatus(customerOrderId, CustomerOrderStatus.CANCELLED, connection);
      await this.stateManager.recordStatusChange(
        { customerOrderId },
        CustomerOrderStatus.CANCELLED,
        reason,
        connection,
      );

      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, connection);
      const items: any[] = [];
      for (const vo of vendorOrders) {
        const cancelableStatuses: VendorOrderStatus[] = [
          VendorOrderStatus.PENDING,
          VendorOrderStatus.CONFIRMED,
          VendorOrderStatus.PROPOSAL_SENT,
        ];
        if (cancelableStatuses.includes(vo.status as VendorOrderStatus)) {
          await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.CANCELLED, connection);
          await this.stateManager.recordStatusChange(
            { vendorOrderId: vo.id },
            VendorOrderStatus.CANCELLED,
            reason,
            connection,
          );
        }
        const voItems = await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection);
        for (const item of voItems) {
          items.push({
            vendorProductId: item.vendorProductId,
            quantity: item.quantity,
            requestedWeightGrams: item.requestedWeightGrams,
            vendorId: vo.vendorId,
          });
        }
      }

      await this.publisher.publishOrderStockReleaseRequested({ orderId: customerOrderId, items });
      await this.publisher.publishOrderCancelled(customerOrderId, co.customerId);
    });
  }

  async calculateDeliveryFee(customerLat: number, customerLng: number, vendorIds: string[]): Promise<number> {
    const vendorDetailsArray = await Promise.all(vendorIds.map((vid) => this.vendorClient.getVendor(vid)));
    const vendorLocations = vendorDetailsArray
      .filter((v) => v !== null)
      .map((v) => ({ latitude: v!.latitude, longitude: v!.longitude }));

    return DeliveryFeeCalculator.calculate(customerLat, customerLng, vendorLocations);
  }
}
