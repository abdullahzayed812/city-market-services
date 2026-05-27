import { Job } from "bullmq";
import { SlaJobData } from "@city-market/shared/node";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { DeliveryPublisher } from "../../infrastructure/messaging/DeliveryPublisher";
import { Database, Logger } from "@city-market/shared/node";
import { DeliveryStatus } from "@city-market/shared";

export class DeliverySlaWorker {
  constructor(
    private deliveryRepo: IDeliveryRepository,
    private courierRepo: ICourierRepository,
    private publisher: DeliveryPublisher,
    private db: Database,
  ) {}

  async handle(job: Job<SlaJobData>): Promise<void> {
    const { slaType, entityId } = job.data;
    if (slaType === "delivery_acceptance") await this.handleAcceptanceExpired(entityId);
    else if (slaType === "courier_assignment") await this.handleAssignmentExpired(entityId);
    else if (slaType === "courier_pickup") await this.handlePickupExpired(entityId);
  }

  private async handleAcceptanceExpired(deliveryId: string): Promise<void> {
    Logger.warn(`[SLA] delivery_acceptance expired for delivery:${deliveryId}`);

    await this.db.withTransaction(async (connection) => {
      const delivery = await this.deliveryRepo.findById(deliveryId, connection);
      if (!delivery || delivery.status !== DeliveryStatus.PENDING) {
        Logger.info(`[SLA] delivery_acceptance for ${deliveryId} skipped — status is ${delivery?.status ?? "not found"}`);
        return;
      }

      await this.deliveryRepo.update(deliveryId, { status: DeliveryStatus.FAILED }, connection);

      await this.publisher.publishSlaDeliveryAcceptanceExpired({
        deliveryId,
        customerOrderId: delivery.customerOrderId,
        customerId: delivery.customerId,
      });

      // Also fire DELIVERY_FAILED so order-service reverts customer order status
      await this.publisher.publishDeliveryFailed({
        deliveryId,
        customerOrderId: delivery.customerOrderId,
        customerId: delivery.customerId,
      });
    });
  }

  private async handleAssignmentExpired(deliveryId: string): Promise<void> {
    Logger.warn(`[SLA] courier_assignment expired for delivery:${deliveryId}`);

    await this.db.withTransaction(async (connection) => {
      const delivery = await this.deliveryRepo.findById(deliveryId, connection);
      if (!delivery || delivery.status !== DeliveryStatus.ACCEPTED) {
        Logger.info(`[SLA] courier_assignment for ${deliveryId} skipped — status is ${delivery?.status ?? "not found"}`);
        return;
      }

      // Revert to PENDING so another office can accept
      await this.deliveryRepo.update(deliveryId, { status: DeliveryStatus.PENDING, deliveryOfficeId: undefined }, connection);
      await this.deliveryRepo.setDeadline(deliveryId, "assignmentDeadline", null, connection);

      await this.publisher.publishSlaCourierAssignmentExpired({
        deliveryId,
        customerOrderId: delivery.customerOrderId,
        customerId: delivery.customerId,
      });
    });
  }

  private async handlePickupExpired(deliveryId: string): Promise<void> {
    Logger.warn(`[SLA] courier_pickup expired for delivery:${deliveryId}`);

    await this.db.withTransaction(async (connection) => {
      const delivery = await this.deliveryRepo.findById(deliveryId, connection);
      if (!delivery || delivery.status !== DeliveryStatus.ASSIGNED) {
        Logger.info(`[SLA] courier_pickup for ${deliveryId} skipped — status is ${delivery?.status ?? "not found"}`);
        return;
      }

      if (delivery.courierId) {
        await this.courierRepo.updateAvailability(delivery.courierId, true, connection);
      }

      // Revert to ACCEPTED (office still owns it, needs new courier assignment)
      await this.deliveryRepo.update(deliveryId, { status: DeliveryStatus.ACCEPTED }, connection);
      await this.deliveryRepo.setDeadline(deliveryId, "pickupDeadline", null, connection);

      await this.publisher.publishSlaCourierPickupExpired({
        deliveryId,
        customerOrderId: delivery.customerOrderId,
        customerId: delivery.customerId,
        courierId: delivery.courierId,
      });
    });
  }
}
