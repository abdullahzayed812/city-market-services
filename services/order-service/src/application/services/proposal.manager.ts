import { PoolConnection } from "mysql2/promise";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IOrderItemProposalRepository } from "../../core/interfaces/order-item-proposal.repository";
import { ProposeChangesDto } from "../../core/dto/order.dto";
import { OrderStateManager } from "./order-state.manager";
import { CatalogHttpClient } from "../../infrastructure/http/catalog-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";
import {
  VendorOrderStatus,
  CustomerOrderStatus,
  ProposalStatus,
  ProposalType,
  ValidationError,
  NotFoundError,
  MeasurementType,
  PricingStrategyFactory,
} from "@city-market/shared";
import { randomUUID } from "crypto";
import { CommissionCalculator } from "../utils/CommissionCalculator";
import { CommissionTierService } from "./commission-tier.service";

const WEIGHT_TOLERANCE_GRAMS = 100;
const MAX_WEIGHT_DIFFERENCE_THRESHOLD = 0.3;

export class ProposalManager {
  constructor(
    private customerOrderRepo: ICustomerOrderRepository,
    private vendorOrderRepo: IVendorOrderRepository,
    private vendorOrderItemRepo: IVendorOrderItemRepository,
    private proposalRepo: IOrderItemProposalRepository,
    private catalogClient: CatalogHttpClient,
    private vendorClient: VendorHttpClient,
    private publisher: OrderPublisher,
    private stateManager: OrderStateManager,
    private commissionTierService: CommissionTierService,
  ) {}

  async propose(vendorOrderId: string, dto: ProposeChangesDto[], connection: PoolConnection): Promise<void> {
    // 1. Fetch vendor order without lock to get customerOrderId
    const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
    if (!vo) throw new NotFoundError("vendor_order_not_found");

    // 2. Lock Parent (CustomerOrder) FIRST
    const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
    if (!co) throw new NotFoundError("customer_order_not_found");

    // 3. Lock Child (VendorOrder) SECOND
    const lockedVo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
    if (!lockedVo) throw new NotFoundError("vendor_order_not_found");

    let statusChangedToProposal = false;
    let autoAcceptedAny = false;

    for (let item of dto) {
      const existingProposals = await this.proposalRepo.findByVendorOrderItem(item.itemId, connection);
      if (existingProposals.some((p) => p.status === ProposalStatus.PENDING)) {
        throw new ValidationError("vendor_order_item_has_pending_proposal");
      }

      const orderItem = await this.vendorOrderItemRepo.findByIdWithLock(item.itemId, connection);
      if (!orderItem) throw new NotFoundError(`order_item_${item.itemId}_not_found`);

      if (item.type === ProposalType.WEIGHT_ADJUSTMENT && item.proposedWeightGrams) {
        if (!orderItem.requestedWeightGrams) throw new ValidationError(`item_${item.itemId}_is_not_weight_based`);

        const diffGrams = Math.abs(item.proposedWeightGrams - orderItem.requestedWeightGrams);
        const diffRatio = diffGrams / orderItem.requestedWeightGrams;

        if (diffRatio > MAX_WEIGHT_DIFFERENCE_THRESHOLD) {
          throw new ValidationError(`weight_adjustment_exceeds_threshold_for_item_${item.itemId}`);
        }

        // Always update the actual weight and price on the item immediately
        const strategy = PricingStrategyFactory.getStrategy(MeasurementType.WEIGHT);
        const newTotalPrice = strategy.calculateTotal(orderItem.unitPrice, item.proposedWeightGrams);
        await this.vendorOrderItemRepo.update(
          orderItem.id,
          {
            actualWeightGrams: item.proposedWeightGrams,
            totalPrice: newTotalPrice,
          },
          connection,
        );
        autoAcceptedAny = true;

        if (diffGrams <= WEIGHT_TOLERANCE_GRAMS) {
          // Within tolerance: No need to create a proposal for customer approval
          continue;
        }
      }

      const proposal: any = {
        id: randomUUID(),
        vendorOrderItemId: item.itemId,
        type: item.type as ProposalType,
        proposedQuantity: item.proposedQuantity,
        actualQuantity: item.actualQuantity,
        requestedWeightGrams: item.requestedWeightGrams,
        proposedWeightGrams: item.proposedWeightGrams,
        status: ProposalStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.proposalRepo.create(proposal, connection);

      if (item.type === ProposalType.QUANTITY_REDUCTION && item.proposedQuantity) {
        await this.vendorOrderItemRepo.update(item.itemId, { proposedQuantity: item.proposedQuantity }, connection);
      }

      statusChangedToProposal = true;
    }

    if (autoAcceptedAny) {
      await this.recalculateTotals(vendorOrderId, connection);
    }

    if (statusChangedToProposal) {
      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.PROPOSAL_SENT, connection);
      await this.stateManager.recordStatusChange({ vendorOrderId }, VendorOrderStatus.PROPOSAL_SENT, `Proposals sent.`, connection);

      await this.publisher.publishVendorOrderProposed({
        vendorOrderId,
        customerOrderId: lockedVo.customerOrderId,
        vendorId: lockedVo.vendorId,
        customerId: co.customerId,
      });

      await this.customerOrderRepo.updateStatus(lockedVo.customerOrderId, CustomerOrderStatus.WAITING_CUSTOMER_DECISION, connection);
      await this.stateManager.recordStatusChange(
        { customerOrderId: lockedVo.customerOrderId },
        CustomerOrderStatus.WAITING_CUSTOMER_DECISION,
        `Waiting customer decision`,
        connection,
      );
    }
  }

  async accept(proposalId: string, connection: PoolConnection): Promise<void> {
    const proposal = await this.proposalRepo.findByIdWithLock(proposalId, connection);
    if (!proposal) throw new NotFoundError("proposal_not_found");
    if (proposal.status !== ProposalStatus.PENDING) throw new ValidationError("proposal_already_processed");

    const item = await this.vendorOrderItemRepo.findById(proposal.vendorOrderItemId, connection); // Non-locking to find IDs
    if (!item) throw new NotFoundError("vendor_order_item_not_found");
    const vo = await this.vendorOrderRepo.findById(item.vendorOrderId, connection); // Non-locking to find IDs
    if (!vo) throw new NotFoundError("vendor_order_not_found");

    // 1. Lock Parent (CustomerOrder) FIRST
    const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
    if (!co) throw new NotFoundError("customer_order_not_found");

    // 2. Lock Child (VendorOrder) SECOND
    const lockedVo = await this.vendorOrderRepo.findByIdWithLock(vo.id, connection);
    if (!lockedVo) throw new NotFoundError("vendor_order_not_found");

    // 3. Lock Item
    const lockedItem = await this.vendorOrderItemRepo.findByIdWithLock(item.id, connection);
    if (!lockedItem) throw new NotFoundError("vendor_order_item_not_found");

    if (proposal.type === ProposalType.QUANTITY_REDUCTION && proposal.proposedQuantity) {
      const diff = lockedItem.quantity! - proposal.proposedQuantity;
      await this.catalogClient.releaseStock(lockedItem.vendorProductId, diff, 0);

      await this.vendorOrderItemRepo.update(
        lockedItem.id,
        {
          quantity: proposal.proposedQuantity,
          totalPrice: lockedItem.unitPrice * proposal.proposedQuantity,
          proposedQuantity: null as any,
        },
        connection,
      );
    } else if (proposal.type === ProposalType.WEIGHT_ADJUSTMENT && proposal.proposedWeightGrams) {
      await this.catalogClient.releaseStock(lockedItem.vendorProductId, 0, lockedItem.requestedWeightGrams!);
      const strategy = PricingStrategyFactory.getStrategy(MeasurementType.WEIGHT);
      const newTotalPrice = strategy.calculateTotal(lockedItem.unitPrice, proposal.proposedWeightGrams);
      await this.vendorOrderItemRepo.update(
        lockedItem.id,
        {
          actualWeightGrams: proposal.proposedWeightGrams,
          totalPrice: newTotalPrice,
        },
        connection,
      );
    } else if (proposal.type === ProposalType.UNAVAILABLE) {
      await this.catalogClient.releaseStock(lockedItem.vendorProductId, lockedItem.quantity || 0, lockedItem.requestedWeightGrams || 0);
      await this.vendorOrderItemRepo.update(lockedItem.id, { quantity: 0, requestedWeightGrams: 0, totalPrice: 0, proposedQuantity: null as any }, connection);
    }

    await this.recalculateTotals(lockedVo.id, connection);
    await this.proposalRepo.updateStatus(proposalId, ProposalStatus.ACCEPTED, connection);

    const vendor = await this.vendorClient.getVendor(lockedVo.vendorId);
    await this.publisher.publishProposalAccepted({
      proposalId,
      vendorOrderId: lockedVo.id,
      customerOrderId: co.id,
      vendorId: lockedVo.vendorId,
      customerId: co.customerId,
      vendorUserId: vendor?.userId,
    });

    await this.stateManager.syncVendorOrderStatus(lockedVo.id, connection);
    await this.stateManager.syncCustomerOrderStatus(co.id, connection);
  }

  async reject(proposalId: string, cancelEntireOrder: boolean, connection: PoolConnection): Promise<void> {
    const proposal = await this.proposalRepo.findByIdWithLock(proposalId, connection);
    if (!proposal) throw new NotFoundError("proposal_not_found");
    if (proposal.status !== ProposalStatus.PENDING) throw new ValidationError("proposal_already_processed");

    const item = await this.vendorOrderItemRepo.findById(proposal.vendorOrderItemId, connection);
    if (!item) throw new NotFoundError("vendor_order_item_not_found");
    const vo = await this.vendorOrderRepo.findById(item.vendorOrderId, connection);
    if (!vo) throw new NotFoundError("vendor_order_not_found");

    // 1. Lock Parent (CustomerOrder) FIRST
    const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
    if (!co) throw new NotFoundError("customer_order_not_found");

    // 2. Lock Child (VendorOrder) SECOND
    const lockedVo = await this.vendorOrderRepo.findByIdWithLock(vo.id, connection);
    if (!lockedVo) throw new NotFoundError("vendor_order_not_found");

    await this.catalogClient.releaseStock(item.vendorProductId, item.quantity || 0, item.requestedWeightGrams || 0);

    await this.proposalRepo.updateStatus(proposalId, ProposalStatus.REJECTED, connection);

    const vendor = await this.vendorClient.getVendor(lockedVo.vendorId);
    await this.publisher.publishProposalRejected({
      proposalId,
      vendorOrderId: lockedVo.id,
      customerOrderId: co.id,
      vendorId: lockedVo.vendorId,
      customerId: co.customerId,
      vendorUserId: vendor?.userId,
    });

    if (cancelEntireOrder) {
      await this.cancelOrder(co, connection);
    } else {
      await this.stateManager.syncVendorOrderStatus(lockedVo.id, connection);
      await this.stateManager.syncCustomerOrderStatus(co.id, connection);
    }
  }

  private async cancelOrder(co: any, connection: PoolConnection) {
    await this.customerOrderRepo.updateStatus(co.id, CustomerOrderStatus.CANCELLED, connection);
    await this.stateManager.recordStatusChange({ customerOrderId: co.id }, CustomerOrderStatus.CANCELLED, "Order cancelled on proposal rejection", connection);
    await this.publisher.publishOrderCancelled(co.id, co.customerId);

    const relatedVendorOrders = await this.vendorOrderRepo.findByCustomerOrder(co.id, connection);
    for (const rvo of relatedVendorOrders) {
      if (rvo.status !== VendorOrderStatus.CANCELLED) {
        // Release reservations for all items in this vendor order
        const items = await this.vendorOrderItemRepo.findByVendorOrder(rvo.id, connection);
        for (const item of items) {
          await this.catalogClient.releaseStock(item.vendorProductId, item.quantity || 0, item.requestedWeightGrams || 0);
        }

        await this.vendorOrderRepo.updateStatus(rvo.id, VendorOrderStatus.CANCELLED, connection);
        await this.stateManager.recordStatusChange({ vendorOrderId: rvo.id }, VendorOrderStatus.CANCELLED, "Customer order cancelled", connection);
        await this.publisher.publishVendorOrderCancelled({
          vendorOrderId: rvo.id,
          customerOrderId: co.id,
          vendorId: rvo.vendorId,
          customerId: co.customerId,
        });
      }
    }
  }

  private async recalculateTotals(vendorOrderId: string, connection: PoolConnection): Promise<void> {
    const vo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
    if (!vo) return;

    // 1. Lock Parent FIRST
    const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
    if (!co) return;

    // 2. Lock Child SECOND
    const lockedVo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
    if (!lockedVo) return;

    const tiers = await this.commissionTierService.getAllTiers();

    const items = await this.vendorOrderItemRepo.findByVendorOrder(vendorOrderId, connection);
    const newSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const { amount: commissionAmount, percentage: commissionPercentage } = CommissionCalculator.calculate(newSubtotal, tiers);

    await this.vendorOrderRepo.update(
      vendorOrderId,
      {
        subtotal: newSubtotal,
        totalAmount: newSubtotal,
        commissionAmount,
        commissionPercentage,
      },
      connection,
    );

    const allVo = await this.vendorOrderRepo.findByCustomerOrder(co.id, connection);
    const customerSubtotal = allVo.reduce((sum, v) => sum + (v.status !== VendorOrderStatus.CANCELLED ? v.subtotal : 0), 0);
    const customerCommissionAmount = allVo.reduce((sum, v) => sum + (v.status !== VendorOrderStatus.CANCELLED ? v.commissionAmount : 0), 0);

    await this.customerOrderRepo.update(
      co.id,
      {
        subtotal: customerSubtotal,
        totalAmount: customerSubtotal + co.deliveryFee,
        commissionAmount: customerCommissionAmount,
      },
      connection,
    );
  }
}
