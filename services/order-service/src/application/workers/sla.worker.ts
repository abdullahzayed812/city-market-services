import { Job } from "bullmq";
import { SlaJobData } from "@city-market/shared/node";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { ICustomerOrderRepository } from "../../core/interfaces/customer-order.repository";
import { IOrderItemProposalRepository } from "../../core/interfaces/order-item-proposal.repository";
import { IOrderStatusHistoryRepository } from "../../core/interfaces/order-status-history.repository";
import { IVendorOrderItemRepository } from "../../core/interfaces/vendor-order-item.repository";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";
import { OrderStateManager } from "../services/order-state.manager";
import { ProposalManager } from "../services/proposal.manager";
import { Database, Logger } from "@city-market/shared/node";
import { VendorOrderStatus, CustomerOrderStatus, ProposalStatus } from "@city-market/shared";

export class OrderSlaWorker {
  constructor(
    private vendorOrderRepo: IVendorOrderRepository,
    private customerOrderRepo: ICustomerOrderRepository,
    private proposalRepo: IOrderItemProposalRepository,
    private statusHistoryRepo: IOrderStatusHistoryRepository,
    private vendorOrderItemRepo: IVendorOrderItemRepository,
    private publisher: OrderPublisher,
    private stateManager: OrderStateManager,
    private proposalManager: ProposalManager,
    private db: Database,
  ) {}

  async handle(job: Job<SlaJobData>): Promise<void> {
    const { slaType, entityId } = job.data;
    if (slaType === "vendor_confirmation") {
      await this.handleVendorConfirmationExpired(entityId);
    } else if (slaType === "customer_decision") {
      await this.handleCustomerDecisionExpired(entityId);
    } else if (slaType === "vendor_cancellation_decision") {
      await this.handleVendorCancellationDecisionExpired(entityId);
    }
  }

  private async handleVendorConfirmationExpired(vendorOrderId: string): Promise<void> {
    Logger.warn(`[SLA] vendor_confirmation expired for vendor-order:${vendorOrderId}`);

    await this.db.withTransaction(async (connection) => {
      const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!vo) return;

      if (![VendorOrderStatus.PENDING, VendorOrderStatus.PREPARING].includes(vo.status)) {
        Logger.info(`[SLA] vendor_confirmation for ${vendorOrderId} skipped — status is already ${vo.status}`);
        return;
      }

      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) return;

      const terminalStatuses = [CustomerOrderStatus.COMPLETED, CustomerOrderStatus.CANCELLED, CustomerOrderStatus.CANCELLED_BY_CUSTOMER];
      if (terminalStatuses.includes(co.status)) return;

      await this.vendorOrderRepo.updateStatus(vendorOrderId, VendorOrderStatus.CANCELLED, connection);
      await this.vendorOrderRepo.update(vendorOrderId, { cancellationReason: "Vendor did not respond within SLA window" }, connection);
      await this.stateManager.recordStatusChange({ vendorOrderId }, VendorOrderStatus.CANCELLED, "SLA expired: vendor did not confirm", connection);

      await this.publisher.publishSlaVendorConfirmationExpired({
        vendorOrderId,
        customerOrderId: vo.customerOrderId,
        vendorId: vo.vendorId,
        customerId: co.customerId,
      });

      await this.stateManager.syncCustomerOrderStatus(vo.customerOrderId, connection);
    });
  }

  private async handleCustomerDecisionExpired(vendorOrderId: string): Promise<void> {
    Logger.warn(`[SLA] customer_decision expired for vendor-order:${vendorOrderId}`);

    await this.db.withTransaction(async (connection) => {
      const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!vo) return;

      if (vo.status !== VendorOrderStatus.PROPOSAL_SENT) {
        Logger.info(`[SLA] customer_decision for ${vendorOrderId} skipped — status is already ${vo.status}`);
        return;
      }

      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) return;

      const terminalStatuses = [CustomerOrderStatus.COMPLETED, CustomerOrderStatus.CANCELLED, CustomerOrderStatus.CANCELLED_BY_CUSTOMER];
      if (terminalStatuses.includes(co.status)) return;

      const pendingProposals = await this.proposalRepo.findByVendorOrder(vendorOrderId, connection);
      const stillPending = pendingProposals.filter((p) => p.status === ProposalStatus.PENDING);

      for (const proposal of stillPending) {
        await this.proposalManager.accept(proposal.id, connection);
      }

      await this.publisher.publishSlaCustomerDecisionExpired({
        vendorOrderId,
        customerOrderId: vo.customerOrderId,
        vendorId: vo.vendorId,
        customerId: co.customerId,
        autoAction: "accepted",
      });
    });
  }

  private async handleVendorCancellationDecisionExpired(vendorOrderId: string): Promise<void> {
    Logger.warn(`[SLA] vendor_cancellation_decision expired for vendor-order:${vendorOrderId}`);

    await this.db.withTransaction(async (connection) => {
      const vo = await this.vendorOrderRepo.findByIdWithLock(vendorOrderId, connection);
      if (!vo) return;

      if (vo.status !== VendorOrderStatus.CANCELLED || !vo.customerDecisionDeadline) {
        Logger.info(`[SLA] vendor_cancellation_decision for ${vendorOrderId} skipped — already resolved`);
        return;
      }

      const co = await this.customerOrderRepo.findByIdWithLock(vo.customerOrderId, connection);
      if (!co) return;

      const terminalStatuses = [CustomerOrderStatus.COMPLETED, CustomerOrderStatus.CANCELLED, CustomerOrderStatus.CANCELLED_BY_CUSTOMER];
      if (terminalStatuses.includes(co.status)) return;

      // Conservative default: auto-continue without the cancelled vendor
      await this.vendorOrderRepo.setDeadline(vendorOrderId, "customerDecisionDeadline", null, connection);
      await this.stateManager.syncCustomerOrderStatus(vo.customerOrderId, connection);

      await this.publisher.publishSlaVendorCancellationDecisionExpired({
        vendorOrderId,
        customerOrderId: vo.customerOrderId,
        vendorId: vo.vendorId,
        customerId: co.customerId,
        autoAction: "continued",
      });
    });
  }
}
