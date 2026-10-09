import { Job } from "bullmq";
import { SlaJobData } from "@city-market/shared/node";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { Delivery } from "../../core/entities/delivery.entity";
import { DeliveryPublisher } from "../../infrastructure/messaging/DeliveryPublisher";
import { Database, Logger } from "@city-market/shared/node";
import { DeliveryStatus } from "@city-market/shared";
import { DeliverySlaManager } from "../services/delivery-sla.manager";
import { FreelanceDispatcher } from "../services/freelance-dispatcher";

// Each handler changes state inside a transaction and returns what to do after commit.
// Publishing and rescheduling stay outside: setDeadline() uses its own connection and
// would block on the row lock this transaction holds.
type AfterCommit = Array<() => Promise<void>>;

export class DeliverySlaWorker {
  constructor(
    private deliveryRepo: IDeliveryRepository,
    private courierRepo: ICourierRepository,
    private publisher: DeliveryPublisher,
    private db: Database,
    private slaManager: DeliverySlaManager,
    private dispatcher: FreelanceDispatcher,
  ) {}

  async handle(job: Job<SlaJobData>): Promise<void> {
    const { slaType, entityId } = job.data;
    let afterCommit: AfterCommit = [];
    if (slaType === "delivery_acceptance") afterCommit = await this.handleAcceptanceExpired(entityId);
    else if (slaType === "courier_assignment") afterCommit = await this.handleAssignmentExpired(entityId);
    else if (slaType === "courier_pickup") afterCommit = await this.handlePickupExpired(entityId);
    else if (slaType === "freelance_open") afterCommit = await this.handleFreelanceOpen(entityId);

    for (const step of afterCommit) {
      await step().catch((err) => Logger.error(`[SLA] Post-commit step failed for ${slaType}:${entityId}`, err));
    }
  }

  private params(delivery: Delivery) {
    return { deliveryId: delivery.id, customerOrderId: delivery.customerOrderId, customerId: delivery.customerId };
  }

  private async handleAcceptanceExpired(deliveryId: string): Promise<AfterCommit> {
    Logger.warn(`[SLA] delivery_acceptance expired for delivery:${deliveryId}`);

    return this.db.withTransaction(async (connection) => {
      const delivery = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!delivery || delivery.status !== DeliveryStatus.PENDING) {
        Logger.info(`[SLA] delivery_acceptance for ${deliveryId} skipped — status is ${delivery?.status ?? "not found"}`);
        return [];
      }

      await this.deliveryRepo.update(deliveryId, { status: DeliveryStatus.FAILED }, connection);

      const base = { deliveryId, customerOrderId: delivery.customerOrderId, customerId: delivery.customerId };
      return [
        () => this.slaManager.cancelFreelanceOpen(deliveryId),
        () => this.publisher.publishSlaDeliveryAcceptanceExpired(base),
        // Also fire DELIVERY_FAILED so order-service reverts customer order status
        () => this.publisher.publishDeliveryFailed(base),
      ];
    });
  }

  // F2: the office accepted but never assigned a courier. Back to the pool, and the
  // acceptance clock restarts so it can't sit in PENDING forever.
  private async handleAssignmentExpired(deliveryId: string): Promise<AfterCommit> {
    Logger.warn(`[SLA] courier_assignment expired for delivery:${deliveryId}`);

    return this.db.withTransaction(async (connection) => {
      const delivery = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!delivery || delivery.status !== DeliveryStatus.ACCEPTED) {
        Logger.info(`[SLA] courier_assignment for ${deliveryId} skipped — status is ${delivery?.status ?? "not found"}`);
        return [];
      }

      await this.deliveryRepo.returnToPending(deliveryId, connection);

      return [
        () =>
          this.publisher.publishSlaCourierAssignmentExpired({
            ...this.params(delivery),
            deliveryOfficeId: delivery.deliveryOfficeId ?? null,
          }),
        () => this.slaManager.scheduleAcceptanceSla(this.params(delivery)),
        () => this.publisher.publishDeliveryReturnedToPool({ deliveryId, customerId: delivery.customerId, customerOrderId: delivery.customerOrderId, reason: "office_assignment_expired" }),
        () => this.notifyFreelancers(deliveryId),
      ];
    });
  }

  // F3 / §3.2: the courier never picked up. Clear them off the delivery; an office keeps
  // it and must reassign, a freelance delivery goes back to the pool.
  private async handlePickupExpired(deliveryId: string): Promise<AfterCommit> {
    Logger.warn(`[SLA] courier_pickup expired for delivery:${deliveryId}`);

    return this.db.withTransaction(async (connection) => {
      const delivery = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!delivery || delivery.status !== DeliveryStatus.ASSIGNED) {
        Logger.info(`[SLA] courier_pickup for ${deliveryId} skipped — status is ${delivery?.status ?? "not found"}`);
        return [];
      }

      const isFreelance = delivery.fulfillmentType === "FREELANCE";
      if (delivery.courierId) {
        await this.courierRepo.updateAvailability(delivery.courierId, true, connection);
        await this.courierRepo.incrementCancellations(delivery.courierId, connection);
      }
      if (isFreelance) await this.deliveryRepo.returnToPending(deliveryId, connection);
      else await this.deliveryRepo.revertToAccepted(deliveryId, connection);

      const steps: AfterCommit = [
        () =>
          this.publisher.publishSlaCourierPickupExpired({
            ...this.params(delivery),
            courierId: delivery.courierId,
            deliveryOfficeId: delivery.deliveryOfficeId ?? null,
            fulfillmentType: delivery.fulfillmentType ?? null,
          }),
      ];
      if (isFreelance) {
        steps.push(
          () => this.slaManager.scheduleAcceptanceSla(this.params(delivery)),
          () => this.publisher.publishDeliveryReturnedToPool({ deliveryId, customerId: delivery.customerId, customerOrderId: delivery.customerOrderId, previousCourierId: delivery.courierId, reason: "pickup_expired" }),
          () => this.notifyFreelancers(deliveryId),
        );
      } else {
        steps.push(() => this.slaManager.scheduleAssignmentSla({ ...this.params(delivery), deliveryOfficeId: delivery.deliveryOfficeId }));
      }
      return steps;
    });
  }

  // Office-priority window is over and nobody accepted: tell nearby freelancers.
  private async handleFreelanceOpen(deliveryId: string): Promise<AfterCommit> {
    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery || delivery.status !== DeliveryStatus.PENDING || delivery.deliveryOfficeId || delivery.courierId) return [];
    return [() => this.dispatcher.notifyDeliveryOpen(delivery)];
  }

  private async notifyFreelancers(deliveryId: string): Promise<void> {
    const fresh = await this.deliveryRepo.findById(deliveryId);
    if (fresh) await this.dispatcher.notifyDeliveryOpen(fresh);
  }
}
