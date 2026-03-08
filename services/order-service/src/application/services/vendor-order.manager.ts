import { PoolConnection } from "mysql2/promise";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { OrderStateManager } from "./order-state.manager";
import { ProposalManager } from "./proposal.manager";
import { 
  VendorOrderStatus, 
  ValidationError, 
  NotFoundError, 
  MeasurementType, 
  PricingStrategyFactory 
} from "@city-market/shared";
import { ProposeChangesDto } from "../../core/dto/order.dto";

const WEIGHT_TOLERANCE_GRAMS = 100;
const MAX_WEIGHT_DIFFERENCE_THRESHOLD = 0.3;

export class VendorOrderManager {
  constructor(
    private vendorOrderRepo: IVendorOrderRepository,
    private vendorOrderItemRepo: IVendorOrderItemRepository,
    private stateManager: OrderStateManager,
    private proposalManager: ProposalManager
  ) {}

  async updateStatus(
    vendorOrderId: string,
    status: VendorOrderStatus,
    itemWeights: { itemId: string; actualWeight?: number; actualWeightGrams?: number }[] | undefined,
    notes: string | undefined,
    skipCustomerSync: boolean,
    connection: PoolConnection
  ): Promise<void> {
    const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
    if (!vo) throw new NotFoundError("vendor_order_not_found");

    if (!this.stateManager.isValidVendorStatusTransition(vo.status, status)) {
      throw new ValidationError("invalid_vendor_order_status_transition");
    }

    if (itemWeights && itemWeights.length > 0) {
      await this.handleWeightAdjustments(vendorOrderId, itemWeights, connection);
    }

    const freshVo = await this.vendorOrderRepo.findById(vendorOrderId, connection);
    if (freshVo?.status === vo.status || (freshVo?.status === VendorOrderStatus.PREPARING && status !== VendorOrderStatus.PROPOSAL_SENT)) {
      await this.vendorOrderRepo.updateStatus(vendorOrderId, status, connection);
      await this.stateManager.recordStatusChange({ vendorOrderId }, status, notes, connection);
    }

    if (!skipCustomerSync) {
      await this.stateManager.syncCustomerOrderStatus(vo.customerOrderId, connection);
    }
  }

  private async handleWeightAdjustments(
    vendorOrderId: string,
    itemWeights: { itemId: string; actualWeight?: number; actualWeightGrams?: number }[],
    connection: PoolConnection
  ) {
    const currentItems = await this.vendorOrderItemRepo.findByVendorOrder(vendorOrderId, connection);
    const proposals: ProposeChangesDto[] = [];
    let autoAccepted = false;

    for (const update of itemWeights) {
      const item = currentItems.find(i => i.id === update.itemId);
      if (!item) continue;
      if (item.requestedWeightGrams === undefined) throw new ValidationError(`item_${item.id}_is_not_weight_based`);

      const actualWeightGrams = update.actualWeightGrams || (update.actualWeight ? Math.round(update.actualWeight * 1000) : undefined);
      if (actualWeightGrams === undefined || actualWeightGrams <= 0) throw new ValidationError(`invalid_actual_weight_for_item_${item.id}`);

      const diffGrams = Math.abs(actualWeightGrams - item.requestedWeightGrams);
      const diffRatio = diffGrams / item.requestedWeightGrams;
      if (diffRatio > MAX_WEIGHT_DIFFERENCE_THRESHOLD) {
        throw new ValidationError(`weight_adjustment_exceeds_threshold_for_item_${item.id}`);
      }

      if (diffGrams <= WEIGHT_TOLERANCE_GRAMS) {
        const strategy = PricingStrategyFactory.getStrategy(MeasurementType.WEIGHT);
        const newTotalPrice = strategy.calculateTotal(item.unitPrice, actualWeightGrams);
        await this.vendorOrderItemRepo.update(item.id, {
          actualWeightGrams,
          actualWeight: actualWeightGrams / 1000,
          totalPrice: newTotalPrice
        }, connection);
        autoAccepted = true;
      } else {
        proposals.push({
          itemId: item.id,
          type: "WEIGHT_ADJUSTMENT",
          requestedWeightGrams: item.requestedWeightGrams,
          proposedWeightGrams: actualWeightGrams,
          proposedWeight: actualWeightGrams / 1000
        });
      }
    }

    if (proposals.length > 0) {
      await this.proposalManager.propose(vendorOrderId, proposals, connection);
    } else if (autoAccepted) {
      // Logic to recalculate totals is in ProposalManager, maybe I should move it to a more generic place or just use it from there
      // For now I'll duplicate the recalculate call or move it to a helper
      await (this.proposalManager as any).recalculateTotals(vendorOrderId, connection);
    }
  }
}
