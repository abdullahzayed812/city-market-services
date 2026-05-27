import { Queue, Job } from "bullmq";
import { createSlaQueue, SlaJobData, SlaType, slaJobId } from "@city-market/shared/node";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { DeliveryPublisher } from "../../infrastructure/messaging/DeliveryPublisher";
import { Logger } from "@city-market/shared/node";

const QUEUE_NAME = "sla-delivery";

export class DeliverySlaManager {
  private queue: Queue<SlaJobData>;

  constructor(
    private deliveryRepo: IDeliveryRepository,
    private publisher: DeliveryPublisher,
    redisUrl: string,
    private deliveryAcceptanceSlaMins: number,
    private courierAssignmentSlaMins: number,
    private courierPickupSlaMins: number,
  ) {
    const [host, portStr] = redisUrl.replace(/^redis:\/\//, "").split(":");
    this.queue = createSlaQueue(QUEUE_NAME, { host: host || "localhost", port: parseInt(portStr || "6379", 10) });
  }

  getQueue(): Queue<SlaJobData> {
    return this.queue;
  }

  async scheduleAcceptanceSla(params: { deliveryId: string; customerOrderId: string; customerId: string }): Promise<void> {
    const deadline = new Date(Date.now() + this.deliveryAcceptanceSlaMins * 60_000);
    await this.deliveryRepo.setDeadline(params.deliveryId, "acceptanceDeadline", deadline);

    const jobId = slaJobId("delivery_acceptance", params.deliveryId);
    await this.queue.add(
      "delivery_acceptance",
      { slaType: "delivery_acceptance", entityId: params.deliveryId, entityType: "delivery", customerOrderId: params.customerOrderId, customerId: params.customerId, scheduledAt: new Date().toISOString() },
      { jobId, delay: this.deliveryAcceptanceSlaMins * 60_000 },
    );

    await this.publisher.publishSlaTimerStarted({ slaType: "delivery_acceptance", entityType: "delivery", entityId: params.deliveryId, deadline: deadline.toISOString(), customerOrderId: params.customerOrderId, customerId: params.customerId });
    Logger.info(`[SLA] Scheduled delivery_acceptance for delivery:${params.deliveryId} deadline:${deadline.toISOString()}`);
  }

  async cancelAcceptanceSla(deliveryId: string): Promise<void> {
    const job = await this.queue.getJob(slaJobId("delivery_acceptance", deliveryId));
    if (job) await job.remove();
    await this.deliveryRepo.setDeadline(deliveryId, "acceptanceDeadline", null);
  }

  async scheduleAssignmentSla(params: { deliveryId: string; customerOrderId: string; customerId: string }): Promise<void> {
    const deadline = new Date(Date.now() + this.courierAssignmentSlaMins * 60_000);
    await this.deliveryRepo.setDeadline(params.deliveryId, "assignmentDeadline", deadline);

    const jobId = slaJobId("courier_assignment", params.deliveryId);
    await this.queue.add(
      "courier_assignment",
      { slaType: "courier_assignment", entityId: params.deliveryId, entityType: "delivery", customerOrderId: params.customerOrderId, customerId: params.customerId, scheduledAt: new Date().toISOString() },
      { jobId, delay: this.courierAssignmentSlaMins * 60_000 },
    );

    await this.publisher.publishSlaTimerStarted({ slaType: "courier_assignment", entityType: "delivery", entityId: params.deliveryId, deadline: deadline.toISOString(), customerOrderId: params.customerOrderId, customerId: params.customerId });
    Logger.info(`[SLA] Scheduled courier_assignment for delivery:${params.deliveryId} deadline:${deadline.toISOString()}`);
  }

  async cancelAssignmentSla(deliveryId: string): Promise<void> {
    const job = await this.queue.getJob(slaJobId("courier_assignment", deliveryId));
    if (job) await job.remove();
    await this.deliveryRepo.setDeadline(deliveryId, "assignmentDeadline", null);
  }

  async schedulePickupSla(params: { deliveryId: string; customerOrderId: string; customerId: string; courierId?: string }): Promise<void> {
    const deadline = new Date(Date.now() + this.courierPickupSlaMins * 60_000);
    await this.deliveryRepo.setDeadline(params.deliveryId, "pickupDeadline", deadline);

    const jobId = slaJobId("courier_pickup", params.deliveryId);
    await this.queue.add(
      "courier_pickup",
      { slaType: "courier_pickup", entityId: params.deliveryId, entityType: "delivery", customerOrderId: params.customerOrderId, customerId: params.customerId, courierId: params.courierId, scheduledAt: new Date().toISOString() },
      { jobId, delay: this.courierPickupSlaMins * 60_000 },
    );

    await this.publisher.publishSlaTimerStarted({ slaType: "courier_pickup", entityType: "delivery", entityId: params.deliveryId, deadline: deadline.toISOString(), customerOrderId: params.customerOrderId, customerId: params.customerId, courierId: params.courierId });
    Logger.info(`[SLA] Scheduled courier_pickup for delivery:${params.deliveryId} deadline:${deadline.toISOString()}`);
  }

  async cancelPickupSla(deliveryId: string): Promise<void> {
    const job = await this.queue.getJob(slaJobId("courier_pickup", deliveryId));
    if (job) await job.remove();
    await this.deliveryRepo.setDeadline(deliveryId, "pickupDeadline", null);
  }

  async cancelAllSlas(deliveryId: string): Promise<void> {
    await Promise.allSettled([this.cancelAcceptanceSla(deliveryId), this.cancelAssignmentSla(deliveryId), this.cancelPickupSla(deliveryId)]);
  }

  async runStartupRecovery(handler: (job: Job<SlaJobData>) => Promise<void>): Promise<void> {
    Logger.info("[SLA] Running delivery SLA startup recovery...");

    const helpers: Array<{ find: () => Promise<any[]>; slaType: SlaType; deadlineField: "acceptanceDeadline" | "assignmentDeadline" | "pickupDeadline" }> = [
      { find: () => this.deliveryRepo.findExpiredPending(), slaType: "delivery_acceptance", deadlineField: "acceptanceDeadline" },
      { find: () => this.deliveryRepo.findExpiredAccepted(), slaType: "courier_assignment", deadlineField: "assignmentDeadline" },
      { find: () => this.deliveryRepo.findExpiredAssigned(), slaType: "courier_pickup", deadlineField: "pickupDeadline" },
    ];

    for (const h of helpers) {
      const expired = await h.find();
      for (const d of expired) {
        Logger.warn(`[SLA] Startup: processing expired ${h.slaType} for delivery:${d.id}`);
        await handler({ data: { slaType: h.slaType, entityId: d.id, entityType: "delivery", customerOrderId: d.customerOrderId, customerId: d.customerId, courierId: d.courierId, scheduledAt: "" } } as Job<SlaJobData>);
      }
    }

    const futureHelpers: Array<{ find: () => Promise<any[]>; slaType: SlaType; deadlineField: "acceptanceDeadline" | "assignmentDeadline" | "pickupDeadline" }> = [
      { find: () => this.deliveryRepo.findPendingWithFutureDeadline(), slaType: "delivery_acceptance", deadlineField: "acceptanceDeadline" },
      { find: () => this.deliveryRepo.findAcceptedWithFutureDeadline(), slaType: "courier_assignment", deadlineField: "assignmentDeadline" },
      { find: () => this.deliveryRepo.findAssignedWithFutureDeadline(), slaType: "courier_pickup", deadlineField: "pickupDeadline" },
    ];

    for (const h of futureHelpers) {
      const items = await h.find();
      for (const d of items) {
        const deadline: Date | undefined = d[h.deadlineField];
        if (!deadline) continue;
        const delayMs = Math.max(0, deadline.getTime() - Date.now());
        const jobId = slaJobId(h.slaType, d.id);
        const existing = await this.queue.getJob(jobId);
        if (!existing) {
          await this.queue.add(h.slaType, { slaType: h.slaType, entityId: d.id, entityType: "delivery", customerOrderId: d.customerOrderId, customerId: d.customerId, courierId: d.courierId, scheduledAt: "" }, { jobId, delay: delayMs });
          Logger.info(`[SLA] Recovery: re-enqueued ${h.slaType} for delivery:${d.id} in ${Math.round(delayMs / 1000)}s`);
        }
      }
    }

    Logger.info("[SLA] Delivery SLA startup recovery complete.");
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
