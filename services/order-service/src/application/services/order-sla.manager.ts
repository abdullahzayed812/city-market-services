import { Queue, Job } from "bullmq";
import { createSlaQueue, SlaJobData, SlaType, slaJobId } from "@city-market/shared/node";
import { IVendorOrderRepository } from "../../core/interfaces/vendor-order.repository";
import { OrderPublisher } from "../../infrastructure/messaging/OrderPublisher";
import { Logger } from "@city-market/shared/node";

const QUEUE_NAME = "sla-order";

export class OrderSlaManager {
  private queue: Queue<SlaJobData>;

  constructor(
    private vendorOrderRepo: IVendorOrderRepository,
    private publisher: OrderPublisher,
    redisUrl: string,
    private vendorConfirmationSlaMins: number,
    private customerDecisionSlaMins: number,
  ) {
    const parsedUrl = new URL(redisUrl);
    this.queue = createSlaQueue(QUEUE_NAME, { host: parsedUrl.hostname || "localhost", port: parseInt(parsedUrl.port || "6379", 10), password: parsedUrl.password || undefined });
  }

  getQueue(): Queue<SlaJobData> {
    return this.queue;
  }

  async scheduleVendorConfirmationSla(params: {
    vendorOrderId: string;
    vendorId: string;
    vendorUserId?: string;
    customerOrderId: string;
    customerId: string;
  }): Promise<void> {
    const deadline = new Date(Date.now() + this.vendorConfirmationSlaMins * 60_000);
    const delayMs = this.vendorConfirmationSlaMins * 60_000;

    await this.vendorOrderRepo.setDeadline(params.vendorOrderId, "vendorConfirmationDeadline", deadline);

    const jobId = slaJobId("vendor_confirmation", params.vendorOrderId);
    await this.queue.add(
      "vendor_confirmation",
      {
        slaType: "vendor_confirmation",
        entityId: params.vendorOrderId,
        entityType: "vendor_order",
        customerOrderId: params.customerOrderId,
        customerId: params.customerId,
        vendorId: params.vendorId,
        vendorUserId: params.vendorUserId,
        scheduledAt: new Date().toISOString(),
      },
      { jobId, delay: delayMs },
    );

    await this.publisher.publishSlaTimerStarted({
      slaType: "vendor_confirmation",
      entityType: "vendor_order",
      entityId: params.vendorOrderId,
      deadline: deadline.toISOString(),
      customerOrderId: params.customerOrderId,
      customerId: params.customerId,
      vendorId: params.vendorId,
    });

    Logger.info(`[SLA] Scheduled vendor_confirmation for vendor-order:${params.vendorOrderId} deadline:${deadline.toISOString()}`);
  }

  async cancelVendorConfirmationSla(vendorOrderId: string): Promise<void> {
    const jobId = slaJobId("vendor_confirmation", vendorOrderId);
    const job = await this.queue.getJob(jobId);
    if (job) await job.remove();
    await this.vendorOrderRepo.setDeadline(vendorOrderId, "vendorConfirmationDeadline", null);
    Logger.info(`[SLA] Cancelled vendor_confirmation for vendor-order:${vendorOrderId}`);
  }

  async scheduleCustomerDecisionSla(params: {
    vendorOrderId: string;
    vendorId: string;
    customerOrderId: string;
    customerId: string;
  }): Promise<void> {
    const deadline = new Date(Date.now() + this.customerDecisionSlaMins * 60_000);
    const delayMs = this.customerDecisionSlaMins * 60_000;

    await this.vendorOrderRepo.setDeadline(params.vendorOrderId, "customerDecisionDeadline", deadline);

    const jobId = slaJobId("customer_decision", params.vendorOrderId);
    await this.queue.add(
      "customer_decision",
      {
        slaType: "customer_decision",
        entityId: params.vendorOrderId,
        entityType: "vendor_order",
        customerOrderId: params.customerOrderId,
        customerId: params.customerId,
        vendorId: params.vendorId,
        scheduledAt: new Date().toISOString(),
      },
      { jobId, delay: delayMs },
    );

    await this.publisher.publishSlaTimerStarted({
      slaType: "customer_decision",
      entityType: "vendor_order",
      entityId: params.vendorOrderId,
      deadline: deadline.toISOString(),
      customerOrderId: params.customerOrderId,
      customerId: params.customerId,
      vendorId: params.vendorId,
    });

    Logger.info(`[SLA] Scheduled customer_decision for vendor-order:${params.vendorOrderId} deadline:${deadline.toISOString()}`);
  }

  async cancelCustomerDecisionSla(vendorOrderId: string): Promise<void> {
    const jobId = slaJobId("customer_decision", vendorOrderId);
    const job = await this.queue.getJob(jobId);
    if (job) await job.remove();
    await this.vendorOrderRepo.setDeadline(vendorOrderId, "customerDecisionDeadline", null);
    Logger.info(`[SLA] Cancelled customer_decision for vendor-order:${vendorOrderId}`);
  }

  async runStartupRecovery(handler: (job: Job<SlaJobData>) => Promise<void>): Promise<void> {
    Logger.info("[SLA] Running order SLA startup recovery...");

    const expiredPending = await this.vendorOrderRepo.findExpiredPending();
    for (const vo of expiredPending) {
      Logger.warn(`[SLA] Startup: auto-processing expired vendor_confirmation for vendor-order:${vo.id}`);
      await handler({ data: { slaType: "vendor_confirmation", entityId: vo.id, entityType: "vendor_order", customerOrderId: vo.customerOrderId, customerId: "", vendorId: vo.vendorId, scheduledAt: "" } } as Job<SlaJobData>);
    }

    const expiredProposals = await this.vendorOrderRepo.findExpiredProposals();
    for (const vo of expiredProposals) {
      Logger.warn(`[SLA] Startup: auto-processing expired customer_decision for vendor-order:${vo.id}`);
      await handler({ data: { slaType: "customer_decision", entityId: vo.id, entityType: "vendor_order", customerOrderId: vo.customerOrderId, customerId: "", vendorId: vo.vendorId, scheduledAt: "" } } as Job<SlaJobData>);
    }

    const futurePending = await this.vendorOrderRepo.findPendingWithFutureDeadline();
    for (const vo of futurePending) {
      if (!vo.vendorConfirmationDeadline) continue;
      const delayMs = Math.max(0, vo.vendorConfirmationDeadline.getTime() - Date.now());
      const jobId = slaJobId("vendor_confirmation", vo.id);
      const existing = await this.queue.getJob(jobId);
      if (!existing) {
        await this.queue.add("vendor_confirmation", { slaType: "vendor_confirmation", entityId: vo.id, entityType: "vendor_order", customerOrderId: vo.customerOrderId, customerId: "", vendorId: vo.vendorId, scheduledAt: "" }, { jobId, delay: delayMs });
        Logger.info(`[SLA] Recovery: re-enqueued vendor_confirmation for vendor-order:${vo.id} in ${Math.round(delayMs / 1000)}s`);
      }
    }

    const futureProposals = await this.vendorOrderRepo.findProposalWithFutureDeadline();
    for (const vo of futureProposals) {
      if (!vo.customerDecisionDeadline) continue;
      const delayMs = Math.max(0, vo.customerDecisionDeadline.getTime() - Date.now());
      const jobId = slaJobId("customer_decision", vo.id);
      const existing = await this.queue.getJob(jobId);
      if (!existing) {
        await this.queue.add("customer_decision", { slaType: "customer_decision", entityId: vo.id, entityType: "vendor_order", customerOrderId: vo.customerOrderId, customerId: "", vendorId: vo.vendorId, scheduledAt: "" }, { jobId, delay: delayMs });
        Logger.info(`[SLA] Recovery: re-enqueued customer_decision for vendor-order:${vo.id} in ${Math.round(delayMs / 1000)}s`);
      }
    }

    Logger.info("[SLA] Order SLA startup recovery complete.");
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
