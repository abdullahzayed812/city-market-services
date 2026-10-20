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
import { CustomerOrderStatus, VendorOrderStatus, ValidationError, NotFoundError, ProposalStatus, EventType } from "@city-market/shared";
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
import { CustomerOrderListFilter } from "../../core/interfaces/customer-order.repository";
import { withTransactionAndEvents } from "../../infrastructure/messaging/after-commit";

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
    this.stateManager = new OrderStateManager(customerOrderRepo, vendorOrderRepo, proposalRepo, statusHistoryRepo, publisher);
    this.proposalManager = new ProposalManager(
      customerOrderRepo,
      vendorOrderRepo,
      vendorOrderItemRepo,
      proposalRepo,
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
    this.vendorOrderManager = new VendorOrderManager(vendorOrderRepo, vendorOrderItemRepo, this.stateManager, this.proposalManager);
  }

  async createOrder(dto: CreateOrderDto, userId?: string): Promise<OrderWithItems> {
    if (userId) {
      const hasPenalty = await this.userClient.hasActivePenalty(userId);
      if (hasPenalty) throw new ValidationError("cod_blocked_due_to_penalty");
    }

    const result = await this.creationManager.create(dto, userId, (fn) => withTransactionAndEvents(this.db, fn));
    return OrderMapper.mapOrderWithItems(result.order, result.vendorOrders);
  }

  // withCustomerName: admins see who placed the order (customers already know)
  async getCustomerOrderById(id: string, userId?: string, withCustomerName = false): Promise<OrderWithItems> {
    const customerOrder = await this.customerOrderRepo.findById(id);
    if (!customerOrder) throw new NotFoundError("order_not_found");

    const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(id);
    const uniqueVendorIds = Array.from(new Set(vendorOrders.map((vo) => vo.vendorId)));
    const vendorDetailsArray = await Promise.all(uniqueVendorIds.map((vid) => this.vendorClient.getVendor(vid, userId)));
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

    const result = OrderMapper.mapOrderWithItems(customerOrder, vendorOrdersWithItems);
    if (withCustomerName) {
      const names = await this.userClient.getCustomerNamesByIds([customerOrder.customerId]);
      result.order = { ...result.order, customerName: names.get(customerOrder.customerId) };
    }
    return result;
  }

  // Same shape as getCustomerOrderById for many orders at once: one query per table
  // and one vendor lookup per distinct vendor. delivery-service enriches up to 50
  // deliveries per list call, and fetching those one order at a time was the main
  // cost of GET /delivery/deliveries/pending under load. Unknown ids are skipped.
  async getCustomerOrdersByIds(ids: string[], userId?: string): Promise<OrderWithItems[]> {
    const customerOrders = await this.customerOrderRepo.findByIds(Array.from(new Set(ids)));
    if (customerOrders.length === 0) return [];

    const vendorOrders = await this.vendorOrderRepo.findByCustomerOrders(customerOrders.map((o) => o.id));
    const uniqueVendorIds = Array.from(new Set(vendorOrders.map((vo) => vo.vendorId)));
    const [items, vendorDetailsArray] = await Promise.all([
      this.vendorOrderItemRepo.findByVendorOrders(vendorOrders.map((vo) => vo.id)),
      Promise.all(uniqueVendorIds.map((vid) => this.vendorClient.getVendor(vid, userId))),
    ]);
    const vendorMap = new Map(uniqueVendorIds.map((vid, i) => [vid, vendorDetailsArray[i]]));

    const itemsByVendorOrder = new Map<string, typeof items>();
    for (const item of items) {
      itemsByVendorOrder.set(item.vendorOrderId, [...(itemsByVendorOrder.get(item.vendorOrderId) || []), item]);
    }
    const vendorOrdersByOrder = new Map<string, any[]>();
    for (const vo of vendorOrders) {
      const vendor = vendorMap.get(vo.vendorId);
      const withItems = {
        ...vo,
        vendorName: vendor?.shopName || "Unknown Vendor",
        vendorUserId: vendor?.userId,
        items: itemsByVendorOrder.get(vo.id) || [],
      };
      vendorOrdersByOrder.set(vo.customerOrderId, [...(vendorOrdersByOrder.get(vo.customerOrderId) || []), withItems]);
    }

    return customerOrders.map((order) => OrderMapper.mapOrderWithItems(order, vendorOrdersByOrder.get(order.id) || []));
  }

  async getCustomerOrders(customerId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.customerOrderRepo.findByCustomer(customerId, limit, offset),
      this.customerOrderRepo.countByCustomer(customerId),
    ]);
    const items = rows.map((o) => OrderMapper.mapCustomerOrder(o));
    return { items, total };
  }

  // Admin order list: one page plus the total matching the filters
  async getAllOrders(
    page: number = 1,
    limit: number = 20,
    filter: CustomerOrderListFilter = {},
  ): Promise<{ items: (CustomerOrder & { customerName?: string })[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const [orders, total] = await Promise.all([this.customerOrderRepo.findAll(limit, offset, undefined, filter), this.customerOrderRepo.countFiltered(filter)]);
    const mapped = orders.map((o) => OrderMapper.mapCustomerOrder(o));

    const nameByCustomerId = await this.userClient.getCustomerNamesByIds(mapped.map((o) => o.customerId));

    return {
      items: mapped.map((o) => ({ ...o, customerName: nameByCustomerId.get(o.customerId) })),
      total,
      page,
      limit,
    };
  }

  async getOrderStats(): Promise<{ totalOrders: number; revenueToday: number }> {
    const [totalOrders, revenueToday] = await Promise.all([
      this.customerOrderRepo.countAll(),
      this.customerOrderRepo.sumCommissionToday(CustomerOrderStatus.COMPLETED),
    ]);
    return { totalOrders, revenueToday };
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

  async getVendorOrders(vendorId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const rows = await this.vendorOrderRepo.findByVendorWithItems(vendorId, limit + 1, offset);
    const hasNextPage = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const items = pageRows.map((vo) => OrderMapper.mapVendorOrderWithItems(vo));

    const nameByCustomerId = await this.userClient.getCustomerNamesByIds(pageRows.map((vo) => vo.customerId!));
    const itemsWithNames = items.map((item) => ({
      ...item,
      customerName: nameByCustomerId.get(item.customerId!),
    }));

    return { items: itemsWithNames, hasNextPage };
  }

  async getVendorFinancials(vendorId: string, periodStart?: Date, periodEnd?: Date) {
    return this.vendorOrderRepo.getVendorFinancials(vendorId, periodStart, periodEnd);
  }

  // The customer a customer order belongs to; null when the order doesn't exist
  async getCustomerOrderOwnerId(customerOrderId: string): Promise<string | null> {
    const co = await this.customerOrderRepo.findById(customerOrderId);
    return co?.customerId ?? null;
  }

  // The customer behind a proposal: proposal -> vendor order item -> vendor order -> customer order
  async getProposalOwnerId(proposalId: string): Promise<string | null> {
    const proposal = await this.proposalRepo.findById(proposalId);
    if (!proposal) return null;
    const item = await this.vendorOrderItemRepo.findById(proposal.vendorOrderItemId);
    if (!item) return null;
    const vo = await this.vendorOrderRepo.findById(item.vendorOrderId);
    return vo ? this.getCustomerOrderOwnerId(vo.customerOrderId) : null;
  }

  async getVendorOrderVendorId(id: string): Promise<string> {
    const vo = await this.vendorOrderRepo.findById(id);
    if (!vo) throw new NotFoundError("vendor_order_not_found");
    return vo.vendorId;
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
    const mappedProposals = proposals.filter((p) => p.status === ProposalStatus.PENDING).map((p) => OrderMapper.mapProposal(p));

    return {
      ...mappedVo,
      vendorName: vendor?.shopName || "Unknown Vendor",
      items: mappedItems,
      proposals: mappedProposals,
    };
  }
  async proposeChanges(vendorOrderId: string, dto: ProposeChangesDto[]): Promise<void> {
    return withTransactionAndEvents(this.db, async (connection) => {
      await this.proposalManager.propose(vendorOrderId, dto, connection);
    });
  }

  async acceptVendorOrder(vendorOrderId: string): Promise<void> {
    return withTransactionAndEvents(this.db, async (connection) => {
      // 1. Fetch vendor order without lock to get the parent customerOrderId
      const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("vendor_order_not_found");

      // 2. Lock Parent (CustomerOrder) FIRST
      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) throw new NotFoundError("customer_order_not_found");

      // 3. Lock Child (VendorOrder) SECOND
      const lockedVo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!lockedVo) throw new NotFoundError("vendor_order_not_found");

      if (lockedVo.status !== VendorOrderStatus.PENDING) throw new ValidationError("vendor_can_only_confirm_pending_orders");

      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.PREPARING, connection);
      await this.stateManager.recordStatusChange({ vendorOrderId }, VendorOrderStatus.PREPARING, undefined, connection);

      // Cancel vendor confirmation SLA — vendor responded
      this.stateManager.cancelVendorConfirmationSla(vendorOrderId);

      await this.publisher.publishVendorOrderConfirmed({
        vendorOrderId,
        customerOrderId: lockedVo.customerOrderId,
        vendorId: lockedVo.vendorId,
        customerId: co.customerId,
      });

      await this.stateManager.syncCustomerOrderStatus(lockedVo.customerOrderId, connection);
    });
  }

  async updateVendorOrderStatus(vendorOrderId: string, status: VendorOrderStatus, notes?: string, skipCustomerSync: boolean = false): Promise<void> {
    return withTransactionAndEvents(this.db, async (connection: PoolConnection) => {
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
    return withTransactionAndEvents(this.db, async (connection: PoolConnection) => {
      await this.proposalManager.accept(proposalId, connection);
    });
  }

  async rejectProposal(proposalId: string, cancelEntireOrder: boolean = false): Promise<void> {
    return withTransactionAndEvents(this.db, async (connection: PoolConnection) => {
      await this.proposalManager.reject(proposalId, cancelEntireOrder, connection);
    });
  }

  async resolveVendorCancellation(customerOrderId: string, continueOrder: boolean): Promise<void> {
    return withTransactionAndEvents(this.db, async (connection: PoolConnection) => {
      await this.proposalManager.resolveVendorCancellation(customerOrderId, continueOrder, connection);
    });
  }

  async updateCustomerOrderStatus(customerOrderId: string, status: CustomerOrderStatus, notes?: string): Promise<void> {
    return withTransactionAndEvents(this.db, async (connection: PoolConnection) => {
      const co = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
      if (!co) throw new NotFoundError("customer_order_not_found");

      if (co.status === status) return;

      if (!this.stateManager.isValidCustomerStatusTransition(co.status, status)) throw new ValidationError("invalid_customer_order_status_transition");

      await this.customerOrderRepo.updateStatus(customerOrderId, status, connection);
      await this.stateManager.recordStatusChange({ customerOrderId }, status, notes, connection);

      if (status === CustomerOrderStatus.COMPLETED) {
        // delivery-service's ORDER_DELIVERED already committed the stock of each vendor order
        // it delivered (and marked it DELIVERED). Re-sending every item here committed that
        // stock twice, and for a split order it committed the other deliveries' items as soon
        // as the first one arrived. Only vendor orders completed some other way (an admin
        // completing the order by hand) still need their stock committed here.
        const vendorOrders = (await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, connection)).filter(
          (vo) => vo.status !== VendorOrderStatus.DELIVERED && vo.status !== VendorOrderStatus.CANCELLED,
        );
        if (vendorOrders.length === 0) return;
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

  // A delivery reached `status` (PICKED_UP / IN_DELIVERY / COMPLETED). An order split across
  // far-apart stores has one delivery per vendor order, each sending its own events, so the
  // customer order moves forward with the first delivery to reach a stage, never moves back,
  // and completes only once every vendor order still in the order has been delivered.
  async advanceCustomerOrderFromDelivery(customerOrderId: string, status: CustomerOrderStatus, notes?: string): Promise<void> {
    const co = await this.customerOrderRepo.findById(customerOrderId);
    if (!co || co.status === status) return;

    if (status === CustomerOrderStatus.COMPLETED) {
      const active = (await this.vendorOrderRepo.findByCustomerOrder(customerOrderId)).filter((vo) => vo.status !== VendorOrderStatus.CANCELLED);
      if (active.length === 0 || active.some((vo) => vo.status !== VendorOrderStatus.DELIVERED)) {
        Logger.info(`Order ${customerOrderId}: a delivery completed, others still on the way`);
        return;
      }
    }

    // Another delivery of the same order already moved it past this stage
    if (!this.stateManager.isValidCustomerStatusTransition(co.status, status)) return;

    // Status may have changed since the read above; updateCustomerOrderStatus re-checks under lock
    await this.updateCustomerOrderStatus(customerOrderId, status, notes);
  }

  // vendorOrderIds: the vendor orders of the delivery that failed. When the order was split
  // and other deliveries are still active (or delivered), only those vendor orders are
  // cancelled and only their stock is released; the rest of the order carries on. Without
  // them (events from before deliveries sent the ids) the whole order fails, as before.
  async cancelOrderDueToDeliveryFailure(customerOrderId: string, courierReason?: string, vendorOrderIds?: string[]): Promise<void> {
    if (vendorOrderIds?.length) {
      const partial = await this.cancelFailedDeliveryPart(customerOrderId, vendorOrderIds, courierReason || "Delivery failed");
      if (partial) return;
    }
    return this.cancelWholeOrderDueToDeliveryFailure(customerOrderId, courierReason);
  }

  // Returns false when nothing else in the order survives the failed delivery, so the
  // caller fails the whole order instead.
  private async cancelFailedDeliveryPart(customerOrderId: string, vendorOrderIds: string[], reason: string): Promise<boolean> {
    const completeAfter = await withTransactionAndEvents(this.db, async (connection) => {
      const co = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
      if (!co) return null;

      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, connection);
      const failedIds = new Set(vendorOrderIds);
      // Only vendor orders that really belong to this customer order
      const failed = vendorOrders.filter((vo) => failedIds.has(vo.id));
      const remaining = vendorOrders.filter((vo) => !failedIds.has(vo.id) && vo.status !== VendorOrderStatus.CANCELLED);
      if (failed.length === 0 || remaining.length === 0) return false;

      const terminalStatuses: CustomerOrderStatus[] = [CustomerOrderStatus.COMPLETED, CustomerOrderStatus.CANCELLED, CustomerOrderStatus.CANCELLED_BY_CUSTOMER];
      if (terminalStatuses.includes(co.status)) return null;

      const items: any[] = [];
      for (const vo of failed) {
        if (vo.status === VendorOrderStatus.DELIVERED || vo.status === VendorOrderStatus.CANCELLED) continue;
        await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.CANCELLED, connection);
        await this.vendorOrderRepo.update(vo.id, { cancellationReason: reason }, connection);
        await this.stateManager.recordStatusChange({ vendorOrderId: vo.id }, VendorOrderStatus.CANCELLED, reason, connection);
        for (const item of await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection)) {
          items.push({
            vendorProductId: item.vendorProductId,
            quantity: item.quantity,
            requestedWeightGrams: item.requestedWeightGrams,
            // catalog's release consumer reads weightGrams
            weightGrams: item.requestedWeightGrams,
            vendorId: vo.vendorId,
          });
        }
      }

      // Same convention as a vendor cancellation: order totals cover the vendor orders still in it
      const subtotal = remaining.reduce((sum, vo) => sum + Number(vo.subtotal), 0);
      const commissionAmount = remaining.reduce((sum, vo) => sum + Number(vo.commissionAmount), 0);
      await this.customerOrderRepo.update(customerOrderId, { subtotal, totalAmount: subtotal + Number(co.deliveryFee), commissionAmount }, connection);
      await this.stateManager.recordStatusChange({ customerOrderId }, co.status, `Part of the order failed delivery: ${reason}`, connection);

      if (items.length > 0) await this.publisher.publishOrderStockReleaseRequested({ orderId: customerOrderId, items });
      // The failed part may have been the last one not yet delivered
      return remaining.every((vo) => vo.status === VendorOrderStatus.DELIVERED);
    });

    if (completeAfter === false) return false;
    if (completeAfter) await this.advanceCustomerOrderFromDelivery(customerOrderId, CustomerOrderStatus.COMPLETED, "Remaining deliveries completed");
    return true;
  }

  private async cancelWholeOrderDueToDeliveryFailure(customerOrderId: string, courierReason?: string): Promise<void> {
    return withTransactionAndEvents(this.db, async (connection) => {
      const co = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
      if (!co) return;

      const terminalStatuses: CustomerOrderStatus[] = [CustomerOrderStatus.COMPLETED, CustomerOrderStatus.CANCELLED, CustomerOrderStatus.CANCELLED_BY_CUSTOMER];
      if (terminalStatuses.includes(co.status)) return;

      // DELIVERY_FAILED carries its own reason (acceptance timeout, office cancel, ...);
      // the old default blamed a courier for every one of them.
      const cancellationReason = courierReason || "Delivery failed";
      await this.customerOrderRepo.updateStatus(customerOrderId, CustomerOrderStatus.CANCELLED, connection);
      await this.customerOrderRepo.update(customerOrderId, { cancellationReason }, connection);
      await this.stateManager.recordStatusChange({ customerOrderId }, CustomerOrderStatus.CANCELLED, cancellationReason, connection);

      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, connection);
      const items: any[] = [];
      for (const vo of vendorOrders) {
        const cancelableStatuses: VendorOrderStatus[] = [VendorOrderStatus.PENDING, VendorOrderStatus.CONFIRMED, VendorOrderStatus.PROPOSAL_SENT];
        if (cancelableStatuses.includes(vo.status as VendorOrderStatus)) {
          await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.CANCELLED, connection);
          await this.vendorOrderRepo.update(vo.id, { cancellationReason }, connection);
          await this.stateManager.recordStatusChange({ vendorOrderId: vo.id }, VendorOrderStatus.CANCELLED, cancellationReason, connection);
        }
        const voItems = await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection);
        for (const item of voItems) {
          items.push({
            vendorProductId: item.vendorProductId,
            quantity: item.quantity,
            requestedWeightGrams: item.requestedWeightGrams,
            // catalog's release consumer reads weightGrams
            weightGrams: item.requestedWeightGrams,
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
    const vendorLocations = vendorDetailsArray.filter((v) => v !== null).map((v) => ({ latitude: v!.latitude, longitude: v!.longitude }));

    return DeliveryFeeCalculator.calculate(customerLat, customerLng, vendorLocations);
  }
}
