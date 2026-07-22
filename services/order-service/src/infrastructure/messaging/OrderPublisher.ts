import { BaseEvent, EventType } from "@city-market/shared";
import { RabbitMQBus } from "@city-market/shared/node";
import { randomUUID } from "crypto";

export class OrderPublisher {
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

  async publishOrderCreated(payload: { orderId: string; customerId: string; items: any[] }): Promise<void> {
    await this.publish(EventType.ORDER_CREATED, payload);
  }

  async publishOrderStockCheckRequested(payload: { orderId: string; items: any[] }): Promise<void> {
    await this.publish(EventType.ORDER_STOCK_CHECK_REQUESTED, payload);
  }

  async publishVendorOrderCreated(data: {
    vendorOrderId: string;
    vendorId: string;
    vendorUserId?: string;
    customerOrderId: string;
    customerId: string;
  }): Promise<void> {
    await this.publish(EventType.VENDOR_ORDER_CREATED, data);
  }

  async publishVendorOrderProposed(data: {
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId?: string;
  }): Promise<void> {
    await this.publish(EventType.VENDOR_ORDER_PROPOSED, data);
  }

  async publishVendorOrderConfirmed(data: {
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId: string;
  }): Promise<void> {
    await this.publish(EventType.VENDOR_ORDER_CONFIRMED, data);
  }

  async publishProposalAccepted(data: {
    proposalId: string;
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId: string;
    vendorUserId?: string;
  }): Promise<void> {
    await this.publish(EventType.PROPOSAL_ACCEPTED, data);
  }

  async publishProposalRejected(data: {
    proposalId: string;
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId: string;
    vendorUserId?: string;
  }): Promise<void> {
    await this.publish(EventType.PROPOSAL_REJECTED, data);
  }

  async publishOrderCancelled(customerOrderId: string, customerId: string): Promise<void> {
    await this.publish(EventType.ORDER_CANCELLED, { customerOrderId, customerId });
  }

  async publishVendorOrderCancelled(data: {
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId: string;
  }): Promise<void> {
    await this.publish(EventType.VENDOR_ORDER_CANCELLED, data);
  }

  async publishOrderStockReleaseRequested(payload: { orderId: string; items: any[] }): Promise<void> {
    await this.publish(EventType.ORDER_STOCK_RELEASE_REQUESTED, payload);
  }

  async publishGenericEvent(type: EventType, payload: any): Promise<void> {
    await this.publish(type, payload);
  }

  async publishSlaTimerStarted(payload: {
    slaType: string;
    entityType: string;
    entityId: string;
    deadline: string;
    customerOrderId: string;
    customerId: string;
    vendorId?: string;
  }): Promise<void> {
    await this.publish(EventType.SLA_TIMER_STARTED, payload);
  }

  async publishSlaVendorConfirmationExpired(payload: {
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId: string;
  }): Promise<void> {
    await this.publish(EventType.SLA_VENDOR_CONFIRMATION_EXPIRED, payload);
  }

  async publishSlaCustomerDecisionExpired(payload: {
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId: string;
    autoAction: "accepted";
  }): Promise<void> {
    await this.publish(EventType.SLA_CUSTOMER_DECISION_EXPIRED, payload);
  }

  async publishSlaVendorCancellationDecisionExpired(payload: {
    vendorOrderId: string;
    customerOrderId: string;
    vendorId: string;
    customerId: string;
    autoAction: "continued";
  }): Promise<void> {
    await this.publish(EventType.SLA_VENDOR_CANCELLATION_DECISION_EXPIRED, payload);
  }
}
