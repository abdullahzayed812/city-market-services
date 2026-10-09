import { Queue, Job } from "bullmq";
import { createSlaQueue, SlaJobData, SlaType, slaJobId } from "@city-market/shared/node";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { DeliveryPublisher } from "../../infrastructure/messaging/DeliveryPublisher";
import { Logger } from "@city-market/shared/node";

const QUEUE_NAME = "sla-delivery";

type SlaParams = { deliveryId: string; customerOrderId: string; customerId: string; deliveryOfficeId?: string | null };

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
    const parsedUrl = new URL(redisUrl);
    this.queue = createSlaQueue(QUEUE_NAME, { host: parsedUrl.hostname || "localhost", port: parseInt(parsedUrl.port || "6379", 10), password: parsedUrl.password || undefined });
  }

  getQueue(): Queue<SlaJobData> {
    return this.queue;
  }

  // The queue keeps the last 100 completed jobs, and BullMQ silently ignores add() for a
  // jobId that still exists. A delivery can go through the same SLA more than once
  // (e.g. PENDING -> ACCEPTED -> back to PENDING), so drop the old job first.
  private async enqueue(slaType: SlaType, data: SlaJobData, delayMs: number): Promise<void> {
    const jobId = slaJobId(slaType, data.entityId);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      try {
        await existing.remove();
      } catch (err: any) {
        // Active (locked) jobs can't be removed; that only happens if we're called from inside that same job.
        Logger.warn(`[SLA] Could not remove previous job ${jobId}: ${err.message}`);
      }
    }
    await this.queue.add(slaType, data, { jobId, delay: delayMs });
  }

  private async removeJob(slaType: SlaType, deliveryId: string): Promise<void> {
    const job = await this.queue.getJob(slaJobId(slaType, deliveryId));
    if (job) await job.remove();
  }

  // extraMinutes extends the deadline by the office-priority window, so freelancers still
  // get a full acceptance window after offices had theirs.
  async scheduleAcceptanceSla(params: SlaParams, extraMinutes = 0): Promise<void> {
    const minutes = this.deliveryAcceptanceSlaMins + extraMinutes;
    const deadline = new Date(Date.now() + minutes * 60_000);
    await this.deliveryRepo.setDeadline(params.deliveryId, "acceptanceDeadline", deadline);

    await this.enqueue(
      "delivery_acceptance",
      { slaType: "delivery_acceptance", entityId: params.deliveryId, entityType: "delivery", customerOrderId: params.customerOrderId, customerId: params.customerId, scheduledAt: new Date().toISOString() },
      minutes * 60_000,
    );

    await this.publisher.publishSlaTimerStarted({ slaType: "delivery_acceptance", entityType: "delivery", entityId: params.deliveryId, deadline: deadline.toISOString(), customerOrderId: params.customerOrderId, customerId: params.customerId });
    Logger.info(`[SLA] Scheduled delivery_acceptance for delivery:${params.deliveryId} deadline:${deadline.toISOString()}`);
  }

  async cancelAcceptanceSla(deliveryId: string): Promise<void> {
    await this.removeJob("delivery_acceptance", deliveryId);
    await this.deliveryRepo.setDeadline(deliveryId, "acceptanceDeadline", null);
  }

  async scheduleAssignmentSla(params: SlaParams): Promise<void> {
    const deadline = new Date(Date.now() + this.courierAssignmentSlaMins * 60_000);
    await this.deliveryRepo.setDeadline(params.deliveryId, "assignmentDeadline", deadline);

    await this.enqueue(
      "courier_assignment",
      { slaType: "courier_assignment", entityId: params.deliveryId, entityType: "delivery", customerOrderId: params.customerOrderId, customerId: params.customerId, scheduledAt: new Date().toISOString() },
      this.courierAssignmentSlaMins * 60_000,
    );

    await this.publisher.publishSlaTimerStarted({ slaType: "courier_assignment", entityType: "delivery", entityId: params.deliveryId, deadline: deadline.toISOString(), customerOrderId: params.customerOrderId, customerId: params.customerId, deliveryOfficeId: params.deliveryOfficeId });
    Logger.info(`[SLA] Scheduled courier_assignment for delivery:${params.deliveryId} deadline:${deadline.toISOString()}`);
  }

  async cancelAssignmentSla(deliveryId: string): Promise<void> {
    await this.removeJob("courier_assignment", deliveryId);
    await this.deliveryRepo.setDeadline(deliveryId, "assignmentDeadline", null);
  }

  async schedulePickupSla(params: SlaParams & { courierId?: string }): Promise<void> {
    const deadline = new Date(Date.now() + this.courierPickupSlaMins * 60_000);
    await this.deliveryRepo.setDeadline(params.deliveryId, "pickupDeadline", deadline);

    await this.enqueue(
      "courier_pickup",
      { slaType: "courier_pickup", entityId: params.deliveryId, entityType: "delivery", customerOrderId: params.customerOrderId, customerId: params.customerId, courierId: params.courierId, scheduledAt: new Date().toISOString() },
      this.courierPickupSlaMins * 60_000,
    );

    await this.publisher.publishSlaTimerStarted({ slaType: "courier_pickup", entityType: "delivery", entityId: params.deliveryId, deadline: deadline.toISOString(), customerOrderId: params.customerOrderId, customerId: params.customerId, courierId: params.courierId, deliveryOfficeId: params.deliveryOfficeId });
    Logger.info(`[SLA] Scheduled courier_pickup for delivery:${params.deliveryId} deadline:${deadline.toISOString()}`);
  }

  async cancelPickupSla(deliveryId: string): Promise<void> {
    await this.removeJob("courier_pickup", deliveryId);
    await this.deliveryRepo.setDeadline(deliveryId, "pickupDeadline", null);
  }

  // Not a deadline: at `opensAt` the worker notifies nearby freelancers that they may claim.
  async scheduleFreelanceOpen(params: SlaParams, opensAt: Date): Promise<void> {
    await this.enqueue(
      "freelance_open",
      { slaType: "freelance_open", entityId: params.deliveryId, entityType: "delivery", customerOrderId: params.customerOrderId, customerId: params.customerId, scheduledAt: new Date().toISOString() },
      Math.max(0, opensAt.getTime() - Date.now()),
    );
  }

  async cancelFreelanceOpen(deliveryId: string): Promise<void> {
    await this.removeJob("freelance_open", deliveryId);
  }

  async cancelAllSlas(deliveryId: string): Promise<void> {
    await Promise.allSettled([
      this.cancelAcceptanceSla(deliveryId),
      this.cancelAssignmentSla(deliveryId),
      this.cancelPickupSla(deliveryId),
      this.cancelFreelanceOpen(deliveryId),
    ]);
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

    const futureHelpers: Array<{ find: () => Promise<any[]>; slaType: SlaType; deadlineField: "acceptanceDeadline" | "assignmentDeadline" | "pickupDeadline" | "openToFreelanceAt" }> = [
      { find: () => this.deliveryRepo.findPendingWithFutureDeadline(), slaType: "delivery_acceptance", deadlineField: "acceptanceDeadline" },
      { find: () => this.deliveryRepo.findAcceptedWithFutureDeadline(), slaType: "courier_assignment", deadlineField: "assignmentDeadline" },
      { find: () => this.deliveryRepo.findAssignedWithFutureDeadline(), slaType: "courier_pickup", deadlineField: "pickupDeadline" },
      { find: () => this.deliveryRepo.findPendingNotYetOpenToFreelance(), slaType: "freelance_open", deadlineField: "openToFreelanceAt" },
    ];

    for (const h of futureHelpers) {
      const items = await h.find();
      for (const d of items) {
        const deadline: Date | undefined = d[h.deadlineField];
        if (!deadline) continue;
        const delayMs = Math.max(0, new Date(deadline).getTime() - Date.now());
        const jobId = slaJobId(h.slaType, d.id);
        const existing = await this.queue.getJob(jobId);
        // A retained completed/failed job from an earlier round doesn't count as scheduled
        const stale = existing ? (await existing.isCompleted()) || (await existing.isFailed()) : false;
        if (!existing || stale) {
          await this.enqueue(h.slaType, { slaType: h.slaType, entityId: d.id, entityType: "delivery", customerOrderId: d.customerOrderId, customerId: d.customerId, courierId: d.courierId, scheduledAt: "" }, delayMs);
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
