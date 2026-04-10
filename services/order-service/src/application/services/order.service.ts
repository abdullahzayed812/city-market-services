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
} from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { CatalogHttpClient } from "../../infrastructure/http/catalog-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";
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
  private stateManager: OrderStateManager;
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
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();
      const result = await this.creationManager.create(dto, userId, connection);
      await this.db.commit(connection);
      return OrderMapper.mapOrderWithItems(result.order, result.vendorOrders);
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
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
    const uniqueVendorIds = Array.from(new Set(proposals.map(p => p.vendorId).filter(Boolean) as string[]));
    const vendorDetailsArray = await Promise.all(
      uniqueVendorIds.map((vid) => this.vendorClient.getVendor(vid)),
    );
    const vendorMap = new Map(uniqueVendorIds.map((vid, i) => [vid, vendorDetailsArray[i]]));

    return proposals
      .filter((p) => p.status === ProposalStatus.PENDING)
      .map(p => {
        const vendor = p.vendorId ? vendorMap.get(p.vendorId) : null;
        return OrderMapper.mapProposal({
          ...p,
          vendorName: vendor?.shopName || "Unknown Vendor"
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
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();
      await this.proposalManager.propose(vendorOrderId, dto, connection);
      await this.db.commit(connection);
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
  }

  async acceptVendorOrder(vendorOrderId: string): Promise<void> {
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();
      const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("vendor_order_not_found");
      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) throw new NotFoundError("customer_order_not_found");
      if (vo.status !== VendorOrderStatus.PENDING) throw new ValidationError("vendor_can_only_confirm_pending_orders");

      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.PREPARING, connection);
      await this.stateManager.recordStatusChange({ vendorOrderId }, VendorOrderStatus.PREPARING, undefined, connection);

      await this.publisher.publishVendorOrderConfirmed({
        vendorOrderId,
        customerOrderId: vo.customerOrderId,
        vendorId: vo.vendorId,
        customerId: co.customerId,
      });

      await this.stateManager.syncCustomerOrderStatus(vo.customerOrderId, connection);
      await this.db.commit(connection);
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
  }

  async updateVendorOrderStatus(
    vendorOrderId: string,
    status: VendorOrderStatus,
    notes?: string,
    skipCustomerSync: boolean = false,
    // itemWeights?: { itemId: string; actualWeight?: number; actualWeightGrams?: number }[],
  ): Promise<void> {
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();
      await this.vendorOrderManager.updateStatus(
        vendorOrderId,
        status,
        // itemWeights,
        notes,
        skipCustomerSync,
        connection,
      );
      await this.db.commit(connection);
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
  }

  async acceptProposal(proposalId: string): Promise<void> {
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();
      await this.proposalManager.accept(proposalId, connection);
      await this.db.commit(connection);
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
  }

  async rejectProposal(proposalId: string, cancelEntireOrder: boolean = false): Promise<void> {
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();
      await this.proposalManager.reject(proposalId, cancelEntireOrder, connection);
      await this.db.commit(connection);
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
  }

  async updateCustomerOrderStatus(customerOrderId: string, status: CustomerOrderStatus, notes?: string): Promise<void> {
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();
      const co = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
      if (!co) throw new NotFoundError("customer_order_not_found");
      if (!this.stateManager.isValidCustomerStatusTransition(co.status, status))
        throw new ValidationError("invalid_customer_order_status_transition");

      await this.customerOrderRepo.updateStatus(customerOrderId, status, connection);
      await this.stateManager.recordStatusChange({ customerOrderId }, status, notes, connection);

      if (status === CustomerOrderStatus.COMPLETED) {
        const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, connection);
        for (const vo of vendorOrders) {
          const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection);
          for (const item of items) {
            if (item.requestedWeightGrams) {
              const actualWeight = item.actualWeightGrams || item.requestedWeightGrams;
              await this.catalogClient.commitWeightStock(item.vendorProductId, actualWeight, item.requestedWeightGrams);
            }
          }
        }
      }

      await this.db.commit(connection);
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
  }

  async calculateDeliveryFee(customerLat: number, customerLng: number, vendorIds: string[]): Promise<number> {
    const vendorDetailsArray = await Promise.all(
      vendorIds.map((vid) => this.vendorClient.getVendor(vid)),
    );
    const vendorLocations = vendorDetailsArray
      .filter((v) => v !== null)
      .map((v) => ({ latitude: v!.latitude, longitude: v!.longitude }));

    return DeliveryFeeCalculator.calculate(customerLat, customerLng, vendorLocations);
  }
}
