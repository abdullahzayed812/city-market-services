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
  PricingStrategyFactory,
  ProposalType
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
    notes: string | undefined,
    skipCustomerSync: boolean,
    connection: PoolConnection
  ): Promise<void> {
    const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
    if (!vo) throw new NotFoundError("vendor_order_not_found");

    if (!this.stateManager.isValidVendorStatusTransition(vo.status, status)) {
      throw new ValidationError("invalid_vendor_order_status_transition");
    }

    await this.vendorOrderRepo.updateStatus(vendorOrderId, status, connection);
    await this.stateManager.recordStatusChange({ vendorOrderId }, status, notes, connection);

    if (!skipCustomerSync) {
      await this.stateManager.syncCustomerOrderStatus(vo.customerOrderId, connection);
    }
  }
}
