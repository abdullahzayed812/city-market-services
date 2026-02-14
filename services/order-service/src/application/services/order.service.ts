import { randomUUID } from "crypto";
import { PoolConnection } from "mysql2/promise";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { IOrderItemProposalRepository } from "../../core/interfaces/order-item-proposal.repository";
import { IOrderStatusHistoryRepository } from "../../core/interfaces/order-status-history.repository";
import { CustomerOrder } from "../../core/entities/customer-order.entity";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { VendorOrderItem } from "../../core/entities/vendor-order-item.entity";
import { OrderStatusHistory } from "../../core/entities/order-status-history.entity";
import { OrderItemProposal, ProposalType, ProposalStatus } from "../../core/entities/order-item-proposal.entity";
import {
  CreateOrderDto,
  UpdateCustomerOrderStatusDto,
  UpdateVendorOrderStatusDto,
  OrderWithItems,
  ProposeChangesDto,
} from "../../core/dto/order.dto";
import {
  CustomerOrderStatus,
  VendorOrderStatus,
  ValidationError,
  NotFoundError,
  RabbitMQBus,
  EventType,
  Database,
} from "@city-market/shared";
import { CatalogHttpClient, ProductInfo } from "../../infrastructure/http/catalog-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";

const DELIVERY_FEE = 15.0; // Base delivery fee, might be split or duplicated later
const COMMISSION_RATE = 0.1;

export class OrderService {
  constructor(
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private vendorOrderItemRepo: IVendorOrderItemRepository,
    private proposalRepo: IOrderItemProposalRepository,
    private statusHistoryRepo: IOrderStatusHistoryRepository,
    private catalogClient: CatalogHttpClient,
    private vendorClient: VendorHttpClient,
    private eventBus: RabbitMQBus,
    private db: Database
  ) {}

  async createOrder(dto: CreateOrderDto, token?: string): Promise<OrderWithItems> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];
    let createdCustomerOrder: CustomerOrder | undefined;
    const createdVendorOrders: (VendorOrder & { items: VendorOrderItem[] })[] = [];

    try {
      connection = await this.db.beginTransaction();

      if (dto.items.length === 0) {
        throw new ValidationError("Order must have at least one item");
      }

      // Fetch product information (external call, not part of DB transaction)
      const productInfos = await Promise.all(
        dto.items.map((item) => this.catalogClient.getProduct(item.productId, token))
      );

      // Validate products and group by vendor
      const vendorItemsMap = new Map<string, { product: ProductInfo; quantity: number }[]>();

      for (let i = 0; i < productInfos.length; i++) {
        const product = productInfos[i];
        const requestedItem = dto.items[i];

        if (!product) {
          throw new ValidationError(`Product ${requestedItem.productId} not found`);
        }

        if (!product.isAvailable) {
          throw new ValidationError(`Product ${product.name} is not available`);
        }

        // Initial stock check. Final check and decrement is transactional.
        if (product.stockQuantity < requestedItem.quantity) {
          throw new ValidationError(`Insufficient stock for ${product.name}`);
        }

        const vendorItems = vendorItemsMap.get(product.vendorId) || [];
        vendorItems.push({ product, quantity: requestedItem.quantity });
        vendorItemsMap.set(product.vendorId, vendorItems);
      }

      // Calculate totals
      let totalSubtotal = 0;
      const vendorOrdersData: any[] = []; // Temporary structure for vendor orders before creation

      for (const [vendorId, items] of vendorItemsMap.entries()) {
        let vendorSubtotal = 0;
        const vendorItemsData: VendorOrderItem[] = [];

        for (const item of items) {
          const itemTotal = item.product.price * item.quantity;
          vendorSubtotal += itemTotal;

          vendorItemsData.push({
            id: randomUUID(),
            vendorOrderId: "", // Will be set later
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            totalPrice: itemTotal,
          });
        }

        totalSubtotal += vendorSubtotal;
        vendorOrdersData.push({
          id: randomUUID(),
          vendorId,
          subtotal: vendorSubtotal,
          commissionAmount: vendorSubtotal * COMMISSION_RATE,
          totalAmount: vendorSubtotal, // Base amount for vendor
          items: vendorItemsData,
        });
      }

      const deliveryFee = DELIVERY_FEE;
      const totalAmount = totalSubtotal + deliveryFee;

      // Create customer order
      const customerOrder: CustomerOrder = {
        id: randomUUID(),
        customerId: dto.customerId,
        status: CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
        subtotal: totalSubtotal,
        deliveryFee,
        totalAmount,
        commissionAmount: totalSubtotal * COMMISSION_RATE,
        deliveryAddress: dto.deliveryAddress,
        deliveryLatitude: dto.deliveryLatitude,
        deliveryLongitude: dto.deliveryLongitude,
        customerNotes: dto.customerNotes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      createdCustomerOrder = await this.customerOrderRepo.create(customerOrder, connection);
      await this.recordStatusChange(
        { customerOrderId: customerOrder.id },
        CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION,
        undefined,
        connection
      );

      // Create vendor orders and items
      for (const voData of vendorOrdersData) {
        const vendorOrder: VendorOrder = {
          id: voData.id,
          customerOrderId: customerOrder.id,
          vendorId: voData.vendorId,
          status: VendorOrderStatus.PENDING,
          subtotal: voData.subtotal,
          commissionAmount: voData.commissionAmount,
          totalAmount: voData.totalAmount,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.vendorOrderRepo.create(vendorOrder, connection);
        await this.recordStatusChange(
          { vendorOrderId: vendorOrder.id },
          VendorOrderStatus.PENDING,
          undefined,
          connection
        );

        for (const item of voData.items) {
          item.vendorOrderId = vendorOrder.id;
          await this.vendorOrderItemRepo.create(item, connection);
        }

        createdVendorOrders.push({ ...vendorOrder, items: voData.items });

        // Collect VENDOR_ORDER_CREATED event
        eventsToPublish.push({
          id: randomUUID(),
          type: EventType.VENDOR_ORDER_CREATED,
          timestamp: new Date(),
          payload: { vendorOrderId: vendorOrder.id, vendorId: vendorOrder.vendorId, customerOrderId: customerOrder.id },
        });
      }

      // Decrement stock in Catalog Service (external call, if fails, transaction rolls back)
      for (const item of dto.items) {
        // This method was modified to throw an error if stock decrement fails
        await this.catalogClient.checkAndDecrementStock(item.productId, item.quantity);
      }

      // Collect ORDER_CREATED event
      eventsToPublish.push({
        id: randomUUID(),
        type: EventType.ORDER_CREATED,
        timestamp: new Date(),
        payload: { customerOrderId: customerOrder.id, customerId: customerOrder.customerId },
      });

      await this.db.commit(connection);
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    } finally {
      // Emit events after successful transaction commit or if an external transaction is used
      for (const event of eventsToPublish) {
        await this.eventBus.publish(event);
      }
    }

    if (!createdCustomerOrder) {
      // Should not happen with successful commit
      throw new Error("Customer order was not created successfully.");
    }
    return { order: createdCustomerOrder, vendorOrders: createdVendorOrders };
  }

  async getOrderById(id: string, token?: string): Promise<OrderWithItems> {
    const customerOrder = await this.customerOrderRepo.findById(id);
    if (!customerOrder) {
      throw new NotFoundError("Order not found");
    }

    const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(id);
    const vendorOrdersWithItems = await Promise.all(
      vendorOrders.map(async (vo) => {
        const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id);
        const vendor = await this.vendorClient.getVendor(vo.vendorId, token);
        const proposals = await this.proposalRepo.findByVendorOrder(vo.id);
        return {
          ...vo,
          vendorName: vendor?.businessName || "Unknown Vendor",
          items,
          proposals: proposals.filter((p) => p.status === ProposalStatus.PENDING),
        };
      })
    );

    return { order: customerOrder, vendorOrders: vendorOrdersWithItems };
  }

  async getCustomerOrders(customerId: string, page: number = 1, limit: number = 20): Promise<CustomerOrder[]> {
    const offset = (page - 1) * limit;
    return this.customerOrderRepo.findByCustomer(customerId, limit, offset);
  }

  async getAllOrders(page: number = 1, limit: number = 20): Promise<CustomerOrder[]> {
    const offset = (page - 1) * limit;
    return this.customerOrderRepo.findAll(limit, offset);
  }

  async getVendorOrders(vendorId: string, page: number = 1, limit: number = 20): Promise<VendorOrder[]> {
    const offset = (page - 1) * limit;
    return this.vendorOrderRepo.findByVendor(vendorId, limit, offset);
  }

  async getVendorOrderById(
    id: string,
    token?: string
  ): Promise<VendorOrder & { items: VendorOrderItem[]; vendorName: string; proposals: OrderItemProposal[] }> {
    const vo = await this.vendorOrderRepo.findById(id);
    if (!vo) {
      throw new NotFoundError("Vendor order not found");
    }
    const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id);
    const vendor = await this.vendorClient.getVendor(vo.vendorId, token);
    const proposals = await this.proposalRepo.findByVendorOrder(vo.id);
    return {
      ...vo,
      vendorName: vendor?.businessName || "Unknown Vendor",
      items,
      proposals: proposals.filter((p) => p.status === ProposalStatus.PENDING),
    };
  }

  async proposeChanges(vendorOrderId: string, dto: ProposeChangesDto): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      const proposal = {
        id: randomUUID(),
        vendorOrderItemId: dto.itemId,
        type: dto.type as ProposalType,
        proposedQuantity: dto.proposedQuantity,
        status: ProposalStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.proposalRepo.create(proposal, connection);

      // Update vendor order status to reflect proposal
      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.PROPOSAL_SENT, connection);
      await this.recordStatusChange(
        { vendorOrderId },
        VendorOrderStatus.PROPOSAL_SENT,
        `Proposal ${proposal.id} sent.`,
        connection
      );

      eventsToPublish.push({
        id: randomUUID(),
        type: EventType.VENDOR_ORDER_PROPOSED,
        timestamp: new Date(),
        payload: { vendorOrderId, proposalId: proposal.id, customerOrderId: vo.customerOrderId, vendorId: vo.vendorId }, // Added customerOrderId, vendorId
      });

      await this.db.commit(connection);

      // Emit events after successful commit
      for (const event of eventsToPublish) {
        await this.eventBus.publish(event);
      }
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  async acceptVendorOrder(vendorOrderId: string): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      if (vo.status !== VendorOrderStatus.PENDING) {
        throw new ValidationError("Only PENDING orders can be confirmed by vendor");
      }

      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.CONFIRMED, connection);
      await this.recordStatusChange({ vendorOrderId }, VendorOrderStatus.CONFIRMED, undefined, connection);

      eventsToPublish.push({
        id: randomUUID(),
        type: EventType.VENDOR_ORDER_CONFIRMED,
        timestamp: new Date(),
        payload: { vendorOrderId, customerOrderId: vo.customerOrderId, vendorId: vo.vendorId }, // Added vendorId
      });

      await this.db.commit(connection);

      // Publish events after successful commit
      for (const event of eventsToPublish) {
        await this.eventBus.publish(event);
      }

      await this.syncCustomerOrderStatus(vo.customerOrderId);
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  async updateVendorOrderStatus(vendorOrderId: string, status: VendorOrderStatus, notes?: string): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      if (!this.isValidVendorStatusTransition(vo.status, status)) {
        throw new ValidationError(`Cannot transition vendor order from ${vo.status} to ${status}`);
      }

      await this.vendorOrderRepo.updateStatus(vendorOrderId, status, connection);
      await this.recordStatusChange({ vendorOrderId }, status, notes, connection);

      // Emit corresponding VENDOR_ORDER_* event
      let eventType: EventType | null = null;
      switch (status) {
        case VendorOrderStatus.PICKED_UP:
          eventType = EventType.ORDER_PICKED_UP; // Reusing existing EventType, might need new VENDOR_ORDER_PICKED_UP
          break;
        case VendorOrderStatus.ON_THE_WAY:
          eventType = EventType.ORDER_ON_THE_WAY; // Reusing existing EventType
          break;
        case VendorOrderStatus.DELIVERED:
          eventType = EventType.ORDER_DELIVERED; // Reusing existing EventType
          break;
        // For other vendor statuses, no specific VENDOR_ORDER_* event defined yet
        default:
          break;
      }

      if (eventType) {
        eventsToPublish.push({
          id: randomUUID(),
          type: eventType,
          timestamp: new Date(),
          payload: { vendorOrderId, customerOrderId: vo.customerOrderId, vendorId: vo.vendorId, status: status },
        });
      }

      await this.db.commit(connection);

      // Emit events after successful commit
      for (const event of eventsToPublish) {
        await this.eventBus.publish(event);
      }

      await this.syncCustomerOrderStatus(vo.customerOrderId);
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  async updateCustomerOrderStatus(customerOrderId: string, status: CustomerOrderStatus, notes?: string): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const co = await this.customerOrderRepo.findById(customerOrderId, connection);
      if (!co) throw new NotFoundError("Customer order not found");

      if (!this.isValidCustomerStatusTransition(co.status, status)) {
        throw new ValidationError(`Cannot transition customer order from ${co.status} to ${status}`);
      }
      await this.customerOrderRepo.updateStatus(customerOrderId, status, connection);
      await this.recordStatusChange({ customerOrderId }, status, notes, connection);

      // Collect Customer Order status change event
      const eventType = this.getEventTypeForCustomerStatus(status);
      if (eventType) {
        eventsToPublish.push({
          id: randomUUID(),
          type: eventType,
          timestamp: new Date(),
          payload: { customerOrderId, status, customerId: co.customerId },
        });
      }

      await this.db.commit(connection);

      // Emit events after successful commit
      for (const event of eventsToPublish) {
        await this.eventBus.publish(event);
      }
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  private async syncCustomerOrderStatus(customerOrderId: string, externalConnection?: PoolConnection): Promise<void> {
    let conn: PoolConnection | undefined = externalConnection;
    let shouldCommitOrRollback = false;
    const eventsToEmit: any[] = []; // Collect events to emit after commit

    try {
      if (!conn) {
        conn = await this.db.beginTransaction();
        shouldCommitOrRollback = true;
      }

      const customerOrder = await this.customerOrderRepo.findById(customerOrderId, conn);
      if (!customerOrder) {
        if (shouldCommitOrRollback && conn) await this.db.rollback(conn);
        return;
      }

      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, conn);

      const allConfirmed = vendorOrders.every((vo) => vo.status === VendorOrderStatus.CONFIRMED);
      const anyCancelled = vendorOrders.some((vo) => vo.status === VendorOrderStatus.CANCELLED);
      const allCancelled = vendorOrders.every((vo) => vo.status === VendorOrderStatus.CANCELLED);

      let newStatus: CustomerOrderStatus | null = null;

      if (allCancelled) {
        newStatus = CustomerOrderStatus.CANCELLED;
      } else if (allConfirmed) {
        newStatus = CustomerOrderStatus.READY;
      } else if (
        vendorOrders.some(
          (vo) => vo.status === VendorOrderStatus.CONFIRMED || vo.status === VendorOrderStatus.PROPOSAL_SENT
        )
      ) {
        newStatus = CustomerOrderStatus.WAITING_CUSTOMER_DECISION;
      } else if (vendorOrders.some((vo) => vo.status === VendorOrderStatus.PENDING)) {
        newStatus = CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION;
      }

      if (newStatus && newStatus !== customerOrder.status) {
        if (newStatus === CustomerOrderStatus.READY) {
          const affectedRows = await this.customerOrderRepo.conditionalUpdateStatusToReady(customerOrderId, conn);
          if (affectedRows === 1) {
            // Only emit ORDER_READY if the status was actually changed by this execution
            await this.recordStatusChange({ customerOrderId }, newStatus, undefined, conn);
            const eventType = this.getEventTypeForCustomerStatus(newStatus);
            if (eventType) {
              eventsToEmit.push({
                id: randomUUID(),
                type: eventType,
                timestamp: new Date(),
                payload: { customerOrderId, status: newStatus, customerId: customerOrder.customerId },
              });
            }
          }
        } else {
          // For other status transitions, update normally and record change
          await this.customerOrderRepo.updateStatus(customerOrderId, newStatus, conn);
          await this.recordStatusChange({ customerOrderId }, newStatus, undefined, conn);
          const eventType = this.getEventTypeForCustomerStatus(newStatus);
          if (eventType) {
            eventsToEmit.push({
              id: randomUUID(),
              type: eventType,
              timestamp: new Date(),
              payload: { customerOrderId, status: newStatus, customerId: customerOrder.customerId },
            });
          }
        }
      }

      if (shouldCommitOrRollback && conn) {
        await this.db.commit(conn);
      }
    } catch (error) {
      if (shouldCommitOrRollback && conn) {
        await this.db.rollback(conn);
      }
      throw error;
    } finally {
      // Emit events after transaction (whether it was committed locally or externally)
      for (const event of eventsToEmit) {
        await this.eventBus.publish(event);
      }
    }
  }

  async acceptProposal(proposalId: string): Promise<void> {
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();

      const proposal = await this.proposalRepo.findById(proposalId, connection);
      if (!proposal) throw new NotFoundError("Proposal not found");
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new ValidationError("Proposal is not pending or has already been processed.");
      }

      const item = await this.vendorOrderItemRepo.findById(proposal.vendorOrderItemId, connection);
      if (!item) throw new NotFoundError("Vendor order item not found");

      const vo = await this.vendorOrderRepo.findById(item.vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");
      if (vo.status === VendorOrderStatus.CONFIRMED) {
        throw new ValidationError("Vendor order has already been confirmed.");
      }
      if (vo.status === VendorOrderStatus.CANCELLED) {
        throw new ValidationError("Cannot accept proposal for a cancelled vendor order.");
      }

      const co = await this.customerOrderRepo.findById(vo.customerOrderId, connection);
      if (!co) throw new NotFoundError("Customer order not found");

      // 1) Update vendor_order_items based on proposal
      let newQuantity = item.quantity;
      if (proposal.type === ProposalType.QUANTITY_REDUCTION && proposal.proposedQuantity !== undefined) {
        newQuantity = proposal.proposedQuantity;
      } else if (proposal.type === ProposalType.UNAVAILABLE) {
        newQuantity = 0; // Item is now unavailable
      }

      // If newQuantity is 0, we can either remove the item or set quantity to 0.
      // For now, setting quantity to 0, which will make its totalPrice 0.
      const newTotalPrice = item.unitPrice * newQuantity;
      await this.vendorOrderItemRepo.update(item.id, { quantity: newQuantity, totalPrice: newTotalPrice }, connection);

      // 2) Recalculate vendor subtotal and totals
      const vendorOrderItems = await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection);
      const newVendorSubtotal = vendorOrderItems.reduce((sum, currentItem) => sum + currentItem.totalPrice, 0);
      const newVendorCommissionAmount = newVendorSubtotal * COMMISSION_RATE;
      const newVendorTotalAmount = newVendorSubtotal; // Vendor total doesn't include customer delivery fee

      await this.vendorOrderRepo.update(
        vo.id,
        {
          subtotal: newVendorSubtotal,
          commissionAmount: newVendorCommissionAmount,
          totalAmount: newVendorTotalAmount,
          status: VendorOrderStatus.CONFIRMED, // Also update vendor order status to CONFIRMED
        },
        connection
      );

      // 3) Recalculate customer total
      const allVendorOrders = await this.vendorOrderRepo.findByCustomerOrder(co.id, connection);
      const newCustomerSubtotal = allVendorOrders.reduce((sum, currentVo) => {
        // Only include non-cancelled vendor orders in customer subtotal calculation
        return sum + (currentVo.status !== VendorOrderStatus.CANCELLED ? currentVo.subtotal : 0);
      }, 0);
      const newCustomerCommissionAmount = newCustomerSubtotal * COMMISSION_RATE;
      const newCustomerTotalAmount = newCustomerSubtotal + co.deliveryFee;

      await this.customerOrderRepo.update(
        co.id,
        {
          subtotal: newCustomerSubtotal,
          commissionAmount: newCustomerCommissionAmount,
          totalAmount: newCustomerTotalAmount,
        },
        connection
      );

      // 4) Update proposal.status -> ACCEPTED
      await this.proposalRepo.updateStatus(proposalId, ProposalStatus.ACCEPTED, connection);

      // 5) Update vendor_order.status -> CONFIRMED (already done in step 2 update above)
      await this.recordStatusChange(
        { vendorOrderId: vo.id },
        VendorOrderStatus.CONFIRMED,
        `Proposal ${proposal.id} accepted.`,
        connection
      );

      await this.db.commit(connection);

      // Emit events after successful commit
      await this.eventBus.publish({
        id: randomUUID(),
        type: EventType.VENDOR_ORDER_CONFIRMED,
        timestamp: new Date(),
        payload: { vendorOrderId: vo.id, customerOrderId: co.id },
      });
      await this.syncCustomerOrderStatus(co.id);
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  async rejectProposal(proposalId: string, cancelEntireOrder: boolean = false): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const proposal = await this.proposalRepo.findById(proposalId, connection);
      if (!proposal) throw new NotFoundError("Proposal not found");
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new ValidationError("Proposal is not pending or has already been processed.");
      }

      const item = await this.vendorOrderItemRepo.findById(proposal.vendorOrderItemId, connection);
      if (!item) throw new NotFoundError("Vendor order item not found");

      const vo = await this.vendorOrderRepo.findById(item.vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      const co = await this.customerOrderRepo.findById(vo.customerOrderId, connection);
      if (!co) throw new NotFoundError("Customer order not found");

      // Update proposal status
      await this.proposalRepo.updateStatus(proposalId, ProposalStatus.REJECTED, connection);
      eventsToPublish.push({
        id: randomUUID(),
        type: EventType.PROPOSAL_REJECTED,
        timestamp: new Date(),
        payload: {
          proposalId,
          vendorOrderId: vo.id,
          customerOrderId: co.id,
          vendorId: vo.vendorId,
          customerId: co.customerId,
        },
      });

      if (cancelEntireOrder) {
        await this.customerOrderRepo.updateStatus(co.id, CustomerOrderStatus.CANCELLED, connection);
        await this.recordStatusChange(
          { customerOrderId: co.id },
          CustomerOrderStatus.CANCELLED,
          "Proposal rejected & order cancelled",
          connection
        );
        eventsToPublish.push({
          id: randomUUID(),
          type: EventType.ORDER_CANCELLED,
          timestamp: new Date(),
          payload: { customerOrderId: co.id, customerId: co.customerId },
        });
      } else {
        await this.vendorOrderRepo.updateStatus(vo.id, VendorOrderStatus.CANCELLED, connection);
        await this.recordStatusChange(
          { vendorOrderId: vo.id },
          VendorOrderStatus.CANCELLED,
          "Proposal rejected by customer",
          connection
        );
        eventsToPublish.push({
          id: randomUUID(),
          type: EventType.VENDOR_ORDER_CANCELLED,
          timestamp: new Date(),
          payload: { vendorOrderId: vo.id, customerOrderId: co.id, vendorId: vo.vendorId },
        });
        // Call syncCustomerOrderStatus to update customer order status based on vendor order changes
        // This is called outside the transaction, and it manages its own transaction and event emission.
        // It's important that this is called AFTER this transaction commits, so it sees the new state.
      }

      await this.db.commit(connection);

      // Publish events after successful commit
      for (const event of eventsToPublish) {
        await this.eventBus.publish(event);
      }

      // If not cancelling entire order, sync customer order status after events are published
      if (!cancelEntireOrder) {
        await this.syncCustomerOrderStatus(co.id);
      }
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  private async recordStatusChange(
    ids: { customerOrderId?: string; vendorOrderId?: string },
    status: CustomerOrderStatus | VendorOrderStatus,
    notes?: string,
    connection?: PoolConnection
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

  private isValidVendorStatusTransition(currentStatus: VendorOrderStatus, newStatus: VendorOrderStatus): boolean {
    const transitions: Record<VendorOrderStatus, VendorOrderStatus[]> = {
      [VendorOrderStatus.PENDING]: [
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

  private isValidCustomerStatusTransition(currentStatus: CustomerOrderStatus, newStatus: CustomerOrderStatus): boolean {
    const transitions: Record<CustomerOrderStatus, CustomerOrderStatus[]> = {
      [CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION]: [
        CustomerOrderStatus.WAITING_CUSTOMER_DECISION,
        CustomerOrderStatus.READY,
        CustomerOrderStatus.CANCELLED,
      ],
      [CustomerOrderStatus.WAITING_CUSTOMER_DECISION]: [CustomerOrderStatus.READY, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.READY]: [CustomerOrderStatus.IN_DELIVERY, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.IN_DELIVERY]: [CustomerOrderStatus.COMPLETED, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.COMPLETED]: [],
      [CustomerOrderStatus.CANCELLED]: [],
    };
    return transitions[currentStatus]?.includes(newStatus) || false;
  }

  private getEventTypeForCustomerStatus(status: CustomerOrderStatus): EventType | null {
    const mapping: Partial<Record<CustomerOrderStatus, EventType>> = {
      [CustomerOrderStatus.READY]: EventType.ORDER_READY,
      [CustomerOrderStatus.IN_DELIVERY]: EventType.ORDER_ON_THE_WAY, // Assuming IN_DELIVERY maps to ON_THE_WAY
      [CustomerOrderStatus.COMPLETED]: EventType.ORDER_DELIVERED,
      [CustomerOrderStatus.CANCELLED]: EventType.ORDER_CANCELLED,
    };
    return mapping[status] || null;
  }
}
