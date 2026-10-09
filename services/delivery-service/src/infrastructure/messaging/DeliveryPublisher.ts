import { BaseEvent, EventType } from "@city-market/shared";
import { RabbitMQBus } from "@city-market/shared/node";
import { randomUUID } from "crypto";

export class DeliveryPublisher {
  constructor(private eventBus: RabbitMQBus) {}

  private async publish(type: EventType, payload: any): Promise<void> {
    const event: BaseEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date(),
      payload,
    };
    await this.eventBus.publish(event);
  }

  async publishDeliveryCreated(data: { deliveryId: string; customerId: string; customerOrderId: string }): Promise<void> {
    await this.publish(EventType.DELIVERY_CREATED, data);
  }

  async publishOrderPickedUp(data: { deliveryId: string; customerOrderId: string; customerId: string; vendorOrdersIds?: string[]; deliveryOfficeId?: string | null; courierId?: string }): Promise<void> {
    await this.publish(EventType.ORDER_PICKED_UP, data);
  }

  async publishOrderOnTheWay(data: { deliveryId: string; customerOrderId: string; customerId: string; vendorOrdersIds?: string[]; deliveryOfficeId?: string | null; courierId?: string }): Promise<void> {
    await this.publish(EventType.ORDER_ON_THE_WAY, data);
  }

  async publishOrderDelivered(data: {
    deliveryId: string;
    customerOrderId: string;
    customerId: string;
    vendorOrdersIds?: string[];
    items?: any[];
    deliveryOfficeId?: string | null;
    courierId?: string;
  }): Promise<void> {
    await this.publish(EventType.ORDER_DELIVERED, data);
  }

  async publishCourierAssigned(data: {
    deliveryId: string;
    courierId: string;
    courierUserId: string;
    customerId: string;
    customerOrderId: string;
    deliveryOfficeId?: string | null;
    fulfillmentType: "OFFICE" | "FREELANCE";
  }): Promise<void> {
    await this.publish(EventType.COURIER_ASSIGNED, data);
  }

  async publishDeliveryFailed(data: { deliveryId: string; customerOrderId: string; customerId: string; deliveryOfficeId?: string | null; courierId?: string }): Promise<void> {
    await this.publish(EventType.DELIVERY_FAILED, data);
  }

  async publishDeliveryFailedByCourier(data: { deliveryId: string; customerOrderId: string; customerId: string; reason: string; deliveryOfficeId?: string | null; courierId?: string }): Promise<void> {
    await this.publish(EventType.DELIVERY_CANCELLED_BY_COURIER, data);
  }

  async publishDeliveryAccepted(data: { deliveryId: string; officeId: string }): Promise<void> {
    await this.publish(EventType.DELIVERY_ACCEPTED, { ...data, deliveryOfficeId: data.officeId });
  }

  // Office courier backed out before pickup; the office must assign someone else.
  async publishDeliveryReleasedByCourier(data: { deliveryId: string; customerOrderId: string; customerId: string; deliveryOfficeId: string; officeUserId?: string; courierId: string; reason?: string }): Promise<void> {
    await this.publish(EventType.DELIVERY_RELEASED_BY_COURIER, data);
  }

  // No customer fields: this one fans out to every nearby freelancer.
  async publishDeliveryOpenToFreelance(data: { deliveryId: string; courierUserIds: string[] }): Promise<void> {
    await this.publish(EventType.DELIVERY_OPEN_TO_FREELANCE, data);
  }

  async publishDeliveryClaimed(data: { deliveryId: string; courierId: string }): Promise<void> {
    await this.publish(EventType.DELIVERY_CLAIMED, data);
  }

  // customerId only routes it to the customer's own room; pool rooms get { deliveryId } only
  async publishDeliveryReturnedToPool(data: { deliveryId: string; customerId: string; customerOrderId: string; previousCourierId?: string; reason: string }): Promise<void> {
    await this.publish(EventType.DELIVERY_RETURNED_TO_POOL, data);
  }

  async publishOfficeApprovalUpdated(data: { officeId: string; officeUserId: string; approvalStatus: string }): Promise<void> {
    await this.publish(EventType.OFFICE_APPROVAL_UPDATED, data);
  }

  // A manager asked for a new office courier; admins review it
  async publishCourierReviewRequested(data: { courierId: string; courierName: string; deliveryOfficeId: string; officeName: string }): Promise<void> {
    await this.publish(EventType.COURIER_REVIEW_REQUESTED, data);
  }

  async publishCourierApprovalUpdated(data: {
    courierId: string;
    courierUserId: string;
    courierName?: string;
    approvalStatus: string;
    // Set for office couriers: the manager who requested them
    officeUserId?: string;
  }): Promise<void> {
    await this.publish(EventType.COURIER_APPROVAL_UPDATED, data);
  }

  async publishSlaTimerStarted(payload: {
    slaType: string;
    entityType: string;
    entityId: string;
    deadline: string;
    customerOrderId: string;
    customerId: string;
    courierId?: string;
    deliveryOfficeId?: string | null;
  }): Promise<void> {
    await this.publish(EventType.SLA_TIMER_STARTED, payload);
  }

  async publishSlaDeliveryAcceptanceExpired(data: { deliveryId: string; customerOrderId: string; customerId: string }): Promise<void> {
    await this.publish(EventType.SLA_DELIVERY_ACCEPTANCE_EXPIRED, data);
  }

  async publishSlaCourierAssignmentExpired(data: { deliveryId: string; customerOrderId: string; customerId: string; deliveryOfficeId?: string | null }): Promise<void> {
    await this.publish(EventType.SLA_COURIER_ASSIGNMENT_EXPIRED, data);
  }

  async publishSlaCourierPickupExpired(data: {
    deliveryId: string;
    customerOrderId: string;
    customerId: string;
    courierId?: string;
    deliveryOfficeId?: string | null;
    fulfillmentType?: "OFFICE" | "FREELANCE" | null;
  }): Promise<void> {
    await this.publish(EventType.SLA_COURIER_PICKUP_EXPIRED, data);
  }
}
