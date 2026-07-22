import { Queue, Worker, Job, ConnectionOptions } from "bullmq";
import { Logger } from "../utils/logger.js";

export type SlaType =
  | "vendor_confirmation"
  | "customer_decision"
  | "vendor_cancellation_decision"
  | "delivery_acceptance"
  | "courier_assignment"
  | "courier_pickup";

export interface SlaJobData {
  slaType: SlaType;
  entityId: string;
  entityType: "vendor_order" | "delivery";
  customerOrderId: string;
  customerId: string;
  vendorId?: string;
  vendorUserId?: string;
  courierId?: string;
  scheduledAt: string;
}

export function slaJobId(slaType: SlaType, entityId: string): string {
  return `${slaType}-${entityId}`;
}

export function createSlaQueue(queueName: string, connection: ConnectionOptions): Queue<SlaJobData> {
  return new Queue<SlaJobData>(queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
    },
  });
}

export function createSlaWorker(
  queueName: string,
  handler: (job: Job<SlaJobData>) => Promise<void>,
  connection: ConnectionOptions,
  concurrency = 5,
): Worker<SlaJobData> {
  const worker = new Worker<SlaJobData>(queueName, handler, { connection, concurrency });

  worker.on("completed", (job) => {
    Logger.info(`[SLA] Job completed: ${job.id} (${job.data.slaType}:${job.data.entityId})`);
  });

  worker.on("failed", (job, err) => {
    Logger.error(`[SLA] Job failed: ${job?.id} (${job?.data?.slaType}:${job?.data?.entityId}): ${err.message}`);
  });

  return worker;
}
