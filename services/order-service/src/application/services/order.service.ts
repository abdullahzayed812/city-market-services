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
  VendorOrderWithItemsDto,
} from "../../core/dto/order.dto";
import { CustomerOrderStatus, VendorOrderStatus, ValidationError, NotFoundError, EventType } from "@city-market/shared";
import { RabbitMQBus, Database } from "@city-market/shared/node";
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
    private db: Database,
  ) {}

  async createOrder(dto: CreateOrderDto, userId?: string): Promise<OrderWithItems> {
    // Changed to userId
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
        dto.items.map((item) => this.catalogClient.getProduct(item.productId, userId)), // Passed userId
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
        connection,
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
          connection,
        );

        const mergedItems = new Map<string, any>();
        for (const item of voData.items) {
          const existing = mergedItems.get(item.productId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.totalPrice = Number(existing.totalPrice) + Number(item.totalPrice);
          } else {
            item.vendorOrderId = vendorOrder.id;
            mergedItems.set(item.productId, { ...item }); // Clone to avoid mutating original shared references
          }
        }

        const uniqueItems = Array.from(mergedItems.values());
        for (const item of uniqueItems) {
          await this.vendorOrderItemRepo.create(item, connection);
        }

        createdVendorOrders.push({ ...vendorOrder, items: uniqueItems });

        // Collect VENDOR_ORDER_CREATED event
        eventsToPublish.push({
          id: randomUUID(),
          type: EventType.VENDOR_ORDER_CREATED,
          timestamp: new Date(),
          payload: { 
            vendorOrderId: vendorOrder.id, 
            vendorId: vendorOrder.vendorId, 
            customerOrderId: customerOrder.id,
            customerId: customerOrder.customerId 
          },
        });
      }

      // // Decrement stock in Catalog Service (external call, if fails, transaction rolls back)
      // for (const item of dto.items) {
      //   // This method was modified to throw an error if stock decrement fails
      //   await this.catalogClient.checkAndDecrementStock(item.productId, item.quantity, userId); // Passed userId
      // }

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

  async getCustomerOrderById(id: string, userId?: string): Promise<OrderWithItems> {
    // Changed to userId
    const customerOrder = await this.customerOrderRepo.findById(id);
    if (!customerOrder) {
      throw new NotFoundError("Order not found");
    }

    const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(id);

    // Optimize N+1 HTTP Calls by batch-fetching unique vendors
    const uniqueVendorIds = Array.from(new Set(vendorOrders.map((vo) => vo.vendorId)));
    const vendorDetailsArray = await Promise.all(
      uniqueVendorIds.map((vid) => this.vendorClient.getVendor(vid, userId)),
    );
    const vendorMap = new Map(uniqueVendorIds.map((vid, i) => [vid, vendorDetailsArray[i]]));

    const vendorOrdersWithItems = await Promise.all(
      vendorOrders.map(async (vo) => {
        const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id);
        const vendor = vendorMap.get(vo.vendorId); // Passed userId - mapped
        const proposals = await this.proposalRepo.findByVendorOrder(vo.id);
        return {
          ...vo,
          vendorName: vendor?.shopName || "Unknown Vendor",
          items,
          proposals: proposals.filter((p) => p.status === ProposalStatus.PENDING),
        };
      }),
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

  async getVendorOrders(vendorId: string, page: number = 1, limit: number = 20): Promise<VendorOrderWithItemsDto[]> {
    const offset = (page - 1) * limit;
    return this.vendorOrderRepo.findByVendorWithItems(vendorId, limit, offset);
  }

  async getVendorOrderById(
    id: string,
    userId?: string, // Changed to userId
  ): Promise<VendorOrder & { items: VendorOrderItem[]; vendorName: string; proposals: OrderItemProposal[] }> {
    const vo = await this.vendorOrderRepo.findById(id);
    if (!vo) {
      throw new NotFoundError("Vendor order not found");
    }
    const items = await this.vendorOrderItemRepo.findByVendorOrder(vo.id);
    const vendor = await this.vendorClient.getVendor(vo.vendorId, userId); // Passed userId
    const proposals = await this.proposalRepo.findByVendorOrder(vo.id);
    return {
      ...vo,
      vendorName: vendor?.shopName || "Unknown Vendor",
      items,
      proposals: proposals.filter((p) => p.status === ProposalStatus.PENDING),
    };
  }

  async proposeChanges(vendorOrderId: string, dto: ProposeChangesDto[]): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      for (let item of dto) {
        // Prevent multiple pending proposals for the same item
        const existingProposals = await this.proposalRepo.findByVendorOrderItem(item.itemId, connection);
        if (existingProposals.some((p) => p.status === ProposalStatus.PENDING)) {
          throw new ValidationError(`Vendor order item ${item.itemId} already has a pending proposal.`);
        }
        const proposal = {
          id: randomUUID(),
          vendorOrderItemId: item.itemId,
          type: item.type as ProposalType,
          proposedQuantity: item.proposedQuantity,
          status: ProposalStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.proposalRepo.create(proposal, connection);
      }

      // Update vendor order status to reflect proposal ( PROPOSAL_SENT )
      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.PROPOSAL_SENT, connection);
      await this.recordStatusChange(
        { vendorOrderId },
        VendorOrderStatus.PROPOSAL_SENT,
        `Proposals for vendor order #${vendorOrderId} sent.`,
        connection,
      );

      const customerOrderForProposal = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);

      eventsToPublish.push({
        id: randomUUID(),
        type: EventType.VENDOR_ORDER_PROPOSED,
        timestamp: new Date(),
        payload: { 
          vendorOrderId, 
          customerOrderId: vo.customerOrderId, 
          vendorId: vo.vendorId,
          customerId: customerOrderForProposal?.customerId 
        }, // Added customerOrderId, vendorId, customerId
      });

      // Update customer order status to reflect proposal ( WAITING_CUSTOMER_DECISION )
      await this.customerOrderRepo.updateStatus(vo.customerOrderId, CustomerOrderStatus.WAITING_CUSTOMER_DECISION, connection);
      await this.recordStatusChange(
        { customerOrderId: vo.customerOrderId },
        CustomerOrderStatus.WAITING_CUSTOMER_DECISION,
        `Wating customer decision for vendor order #${vendorOrderId} and customer order #${vo.customerOrderId}`,
        connection,
      );

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

      const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) throw new NotFoundError("Customer order not found");

      if (vo.status !== VendorOrderStatus.PENDING) {
        throw new ValidationError("Only PENDING orders can be confirmed by vendor");
      }

      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.CONFIRMED, connection);
      await this.recordStatusChange({ vendorOrderId }, VendorOrderStatus.CONFIRMED, undefined, connection);

      eventsToPublish.push({
        id: randomUUID(),
        type: EventType.VENDOR_ORDER_CONFIRMED,
        timestamp: new Date(),
        payload: { vendorOrderId, customerOrderId: vo.customerOrderId, vendorId: vo.vendorId, customerId: co.customerId },
      });

      await this.syncCustomerOrderStatus(vo.customerOrderId, connection);

      await this.db.commit(connection);

      // Publish events after successful commit
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

  async updateVendorOrderStatus(
    vendorOrderId: string,
    status: VendorOrderStatus,
    notes?: string,
    skipCustomerSync: boolean = false,
  ): Promise<void> {
    let connection: PoolConnection | undefined;
    // const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      if (!this.isValidVendorStatusTransition(vo.status, status)) {
        throw new ValidationError(`Cannot transition vendor order from ${vo.status} to ${status}`);
      }

      await this.vendorOrderRepo.updateStatus(vendorOrderId, status, connection);
      await this.recordStatusChange({ vendorOrderId }, status, notes, connection);

      if (!skipCustomerSync) {
        // ← guard the sync call
        await this.syncCustomerOrderStatus(vo.customerOrderId, connection);
      }

      await this.db.commit(connection);
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

      const co = await this.customerOrderRepo.findByIdWithLock(customerOrderId, connection);
      if (!co) throw new NotFoundError("Customer order not found");

      if (!this.isValidCustomerStatusTransition(co.status, status)) {
        throw new ValidationError(`Cannot transition customer order from ${co.status} to ${status}`);
      }
      await this.customerOrderRepo.updateStatus(customerOrderId, status, connection);
      await this.recordStatusChange({ customerOrderId }, status, notes, connection);

      await this.db.commit(connection);

      // TODO: Check and decrement the related products stock if the order status been COMPLETED
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  async acceptProposal(proposalId: string): Promise<void> {
    let connection: PoolConnection | undefined;
    try {
      connection = await this.db.beginTransaction();

      const proposal = await this.proposalRepo.findByIdWithLock(proposalId, connection);
      if (!proposal) throw new NotFoundError("Proposal not found");
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new ValidationError("Proposal is not pending or has already been processed.");
      }

      const item = await this.vendorOrderItemRepo.findByIdWithLock(proposal.vendorOrderItemId, connection);
      if (!item) throw new NotFoundError("Vendor order item not found");

      const vo = await this.vendorOrderRepo.findByIdWithLock(item.vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");
      if (vo.status === VendorOrderStatus.CONFIRMED) {
        throw new ValidationError("Vendor order has already been confirmed.");
      }
      if (vo.status === VendorOrderStatus.CANCELLED) {
        throw new ValidationError("Cannot accept proposal for a cancelled vendor order.");
      }

      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) throw new NotFoundError("Customer order not found");

      // 1) Update vendor_order_items based on proposal
      let newQuantity = item.quantity;
      if (proposal.type === ProposalType.QUANTITY_REDUCTION && proposal.proposedQuantity !== undefined) {
        newQuantity = proposal.proposedQuantity;
      } else if (proposal.type === ProposalType.UNAVAILABLE) {
        newQuantity = 0;
      }

      const newTotalPrice = item.unitPrice * newQuantity;
      await this.vendorOrderItemRepo.update(item.id, { quantity: newQuantity, totalPrice: newTotalPrice }, connection);

      // 2) Recalculate vendor subtotal and totals
      const vendorOrderItems = await this.vendorOrderItemRepo.findByVendorOrder(vo.id, connection);
      const newVendorSubtotal = vendorOrderItems.reduce((sum, currentItem) => sum + currentItem.totalPrice, 0);
      const newVendorCommissionAmount = newVendorSubtotal * COMMISSION_RATE;
      const newVendorTotalAmount = newVendorSubtotal;

      await this.vendorOrderRepo.update(
        vo.id,
        {
          subtotal: newVendorSubtotal,
          commissionAmount: newVendorCommissionAmount,
          totalAmount: newVendorTotalAmount,
          // Remove status update from here - let syncVendorOrderStatus handle it
        },
        connection,
      );

      // 3) Recalculate customer total
      const allVendorOrders = await this.vendorOrderRepo.findByCustomerOrder(co.id, connection);
      const newCustomerSubtotal = allVendorOrders.reduce((sum, currentVo) => {
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
        connection,
      );

      // 4) Update proposal.status -> ACCEPTED
      await this.proposalRepo.updateStatus(proposalId, ProposalStatus.ACCEPTED, connection);

      const eventsToPublish = [
        {
          id: randomUUID(),
          type: EventType.PROPOSAL_ACCEPTED,
          timestamp: new Date(),
          payload: {
            proposalId,
            vendorOrderId: vo.id,
            customerOrderId: co.id,
            vendorId: vo.vendorId,
            customerId: co.customerId,
          },
        },
      ];

      // 5) Sync vendor order status after commit
      await this.syncVendorOrderStatus(vo.id, connection);

      // 6) Sync customer order status
      await this.syncCustomerOrderStatus(co.id, connection);

      await this.db.commit(connection);

      // Publish events after successful commit
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

  async rejectProposal(proposalId: string, cancelEntireOrder: boolean = false): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: any[] = [];

    try {
      connection = await this.db.beginTransaction();

      const proposal = await this.proposalRepo.findByIdWithLock(proposalId, connection);
      if (!proposal) throw new NotFoundError("Proposal not found");
      if (proposal.status !== ProposalStatus.PENDING) {
        throw new ValidationError("Proposal is not pending or has already been processed.");
      }

      const item = await this.vendorOrderItemRepo.findByIdWithLock(proposal.vendorOrderItemId, connection);
      if (!item) throw new NotFoundError("Vendor order item not found");

      const vo = await this.vendorOrderRepo.findByIdWithLock(item.vendorOrderId, connection);
      if (!vo) throw new NotFoundError("Vendor order not found");

      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
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
          connection,
        );
        eventsToPublish.push({
          id: randomUUID(),
          type: EventType.ORDER_CANCELLED,
          timestamp: new Date(),
          payload: { customerOrderId: co.id, customerId: co.customerId },
        });

        // Fetch all vendor orders for this customer order and cancel them
        const relatedVendorOrders = await this.vendorOrderRepo.findByCustomerOrder(co.id, connection);
        for (const rvo of relatedVendorOrders) {
          if (rvo.status !== VendorOrderStatus.CANCELLED) {
            await this.vendorOrderRepo.updateStatus(rvo.id, VendorOrderStatus.CANCELLED, connection);
            await this.recordStatusChange(
              { vendorOrderId: rvo.id },
              VendorOrderStatus.CANCELLED,
              "Customer order cancelled due to rejected proposal",
              connection,
            );
            eventsToPublish.push({
              id: randomUUID(),
              type: EventType.VENDOR_ORDER_CANCELLED,
              timestamp: new Date(),
              payload: { vendorOrderId: rvo.id, customerOrderId: co.id, vendorId: rvo.vendorId },
            });
          }
        }
      }

      // Sync vendor order status if not cancelling entire order
      if (!cancelEntireOrder) {
        await this.syncVendorOrderStatus(vo.id, connection);
        await this.syncCustomerOrderStatus(co.id, connection);
      }

      await this.db.commit(connection);

      // Publish events after successful commit
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

      const customerOrder = await this.customerOrderRepo.findByIdWithLock(customerOrderId, conn);
      if (!customerOrder) {
        if (shouldCommitOrRollback && conn) await this.db.rollback(conn);
        return;
      }

      const vendorOrders = await this.vendorOrderRepo.findByCustomerOrder(customerOrderId, conn);

      const deliveryStatuses = [VendorOrderStatus.PICKED_UP, VendorOrderStatus.ON_THE_WAY, VendorOrderStatus.DELIVERED];
      // If all non-cancelled vendors are in a delivery phase, don't override
      const allInDelivery = vendorOrders
        .filter((vo) => vo.status !== VendorOrderStatus.CANCELLED)
        .every((vo) => deliveryStatuses.includes(vo.status));
      if (allInDelivery) return; // Customer order is handled by delivery events directly

      const allConfirmed = vendorOrders.every((vo) => vo.status === VendorOrderStatus.CONFIRMED);
      const allCancelled = vendorOrders.every((vo) => vo.status === VendorOrderStatus.CANCELLED);
      // const anyCancelled = vendorOrders.some((vo) => vo.status === VendorOrderStatus.CANCELLED);

      let newStatus: CustomerOrderStatus | null = null;

      if (allCancelled) {
        newStatus = CustomerOrderStatus.CANCELLED;
      } else if (allConfirmed) {
        newStatus = CustomerOrderStatus.READY;
      } else if (
        vendorOrders.some(
          (vo) => vo.status === VendorOrderStatus.CONFIRMED || vo.status === VendorOrderStatus.PROPOSAL_SENT,
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

  private async syncVendorOrderStatus(vendorOrderId: string, externalConnection?: PoolConnection): Promise<void> {
    let conn: PoolConnection | undefined = externalConnection;
    let shouldCommitOrRollback = false;
    const eventsToEmit: any[] = [];

    try {
      if (!conn) {
        conn = await this.db.beginTransaction();
        shouldCommitOrRollback = true;
      }

      const vendorOrder = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, conn);
      if (!vendorOrder) {
        if (shouldCommitOrRollback && conn) await this.db.rollback(conn);
        return;
      }

      // Only sync if vendor order is in PROPOSAL_SENT status
      if (vendorOrder.status !== VendorOrderStatus.PROPOSAL_SENT) {
        if (shouldCommitOrRollback && conn) await this.db.commit(conn);
        return;
      }

      // Get all proposals for this vendor order
      const proposals = await this.proposalRepo.findByVendorOrder(vendorOrderId, conn);

      if (proposals.length === 0) {
        if (shouldCommitOrRollback && conn) await this.db.commit(conn);
        return;
      }

      const allAccepted = proposals.every((p) => p.status === ProposalStatus.ACCEPTED);
      const allRejected = proposals.every((p) => p.status === ProposalStatus.REJECTED);
      const anyPending = proposals.some((p) => p.status === ProposalStatus.PENDING);

      let newStatus: VendorOrderStatus | null = null;

      if (allAccepted) {
        // All proposals accepted -> vendor order is CONFIRMED
        newStatus = VendorOrderStatus.CONFIRMED;
      } else if (allRejected) {
        // All proposals rejected -> vendor order is CANCELLED
        newStatus = VendorOrderStatus.CANCELLED;
      } else if (!anyPending) {
        // Mixed accepted/rejected, no pending -> vendor order is CONFIRMED
        // (some items accepted, some rejected/unavailable)
        newStatus = VendorOrderStatus.CONFIRMED;
      }
      // If there are still pending proposals, don't change status

      if (newStatus) {
        await this.vendorOrderRepo.updateStatus(vendorOrderId, newStatus, conn);
        await this.recordStatusChange(
          { vendorOrderId },
          newStatus,
          `All proposals ${allAccepted ? "accepted" : allRejected ? "rejected" : "processed"}`,
          conn,
        );

        const eventType = this.getEventTypeForVendorStatus(newStatus);
        if (eventType) {
          eventsToEmit.push({
            id: randomUUID(),
            type: eventType,
            timestamp: new Date(),
            payload: {
              vendorOrderId,
              customerOrderId: vendorOrder.customerOrderId,
              vendorId: vendorOrder.vendorId,
              status: newStatus,
            },
          });
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
      for (const event of eventsToEmit) {
        await this.eventBus.publish(event);
      }
    }
  }

  private async recordStatusChange(
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
      [CustomerOrderStatus.READY]: [CustomerOrderStatus.PICKED_UP, CustomerOrderStatus.CANCELLED],
      [CustomerOrderStatus.PICKED_UP]: [CustomerOrderStatus.IN_DELIVERY, CustomerOrderStatus.CANCELLED],
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
