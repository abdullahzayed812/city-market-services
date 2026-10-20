import { NotificationService } from "../../application/services/notification.service";
import { rabbitMQBus, Logger } from "@city-market/shared/node";
import { BaseEvent, EventType, AppType } from "@city-market/shared";

export class EventConsumer {
  constructor(private notificationService: NotificationService) { }

  async start() {
    // 1. Order Events
    await rabbitMQBus.subscribe(EventType.ORDER_CREATED, "notification_order_created", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "ORDER_CREATED",
        "notification_order_created_title",
        "notification_order_created_message",
        { orderId: customerOrderId, type: "ORDER_CREATED", role: "CUSTOMER" },
      );
    });

    await rabbitMQBus.subscribe(
      EventType.VENDOR_ORDER_CREATED,
      "notification_vendor_order_created",
      async (event: BaseEvent) => {
        const { vendorOrderId, vendorId, vendorUserId, customerOrderId } = event.payload;
        // Fix: Send notification to the vendor's actual User ID, not their Shop ID
        if (vendorUserId) {
          await this.notificationService.sendNotification(
            vendorUserId,
            "ORDER_CREATED",
            "notification_vendor_order_created_title",
            "notification_vendor_order_created_message",
            { orderId: vendorOrderId, customerOrderId, type: "ORDER_CREATED", role: "VENDOR" },
          );
        } else {
          Logger.warn(`[EventConsumer] No vendorUserId provided for VENDOR_ORDER_CREATED event on vendor ${vendorId}`);
        }
      },
    );

    await rabbitMQBus.subscribe(
      EventType.VENDOR_ORDER_CONFIRMED,
      "notification_vendor_order_confirmed",
      async (event: BaseEvent) => {
        const { customerOrderId, customerId } = event.payload;
        await this.notificationService.sendNotification(
          customerId,
          "ORDER_UPDATE",
          "notification_vendor_order_confirmed_title",
          "notification_vendor_order_confirmed_message",
          { orderId: customerOrderId, type: "ORDER_UPDATE", role: "CUSTOMER" },
        );
      },
    );

    await rabbitMQBus.subscribe(
      EventType.VENDOR_ORDER_PROPOSED,
      "notification_vendor_order_proposed",
      async (event: BaseEvent) => {
        const { customerOrderId, customerId } = event.payload;
        await this.notificationService.sendNotification(
          customerId,
          "ORDER_UPDATE",
          "notification_vendor_order_proposed_title",
          "notification_vendor_order_proposed_message",
          { orderId: customerOrderId, type: "ORDER_CHANGES_PROPOSED", role: "CUSTOMER" },
        );
      },
    );

    await rabbitMQBus.subscribe(
      EventType.PROPOSAL_ACCEPTED,
      "notification_proposal_accepted",
      async (event: BaseEvent) => {
        const { vendorOrderId, customerOrderId, vendorUserId } = event.payload;
        if (vendorUserId) {
          await this.notificationService.sendNotification(
            vendorUserId,
            "PROPOSAL_DECISION",
            "notification_proposal_accepted_title",
            "notification_proposal_accepted_message",
            { orderId: vendorOrderId, customerOrderId, type: "ORDER_UPDATE", role: "VENDOR" },
          );
        }
      },
    );

    await rabbitMQBus.subscribe(
      EventType.PROPOSAL_REJECTED,
      "notification_proposal_rejected",
      async (event: BaseEvent) => {
        const { vendorOrderId, customerOrderId, vendorUserId } = event.payload;
        if (vendorUserId) {
          await this.notificationService.sendNotification(
            vendorUserId,
            "PROPOSAL_DECISION",
            "notification_proposal_rejected_title",
            "notification_proposal_rejected_message",
            { orderId: vendorOrderId, customerOrderId, type: "ORDER_UPDATE", role: "VENDOR" },
          );
        }
      },
    );

    await rabbitMQBus.subscribe(
      EventType.VENDOR_ORDER_CANCELLED,
      "notification_vendor_order_cancelled",
      async (event: BaseEvent) => {
        const { customerOrderId, customerId } = event.payload;
        if (customerId) {
          await this.notificationService.sendNotification(
            customerId,
            "ORDER_UPDATE",
            "notification_vendor_order_cancelled_title",
            "notification_vendor_order_cancelled_message",
            { orderId: customerOrderId, type: "ORDER_UPDATE", role: "CUSTOMER" },
          );
        }
      },
    );

    await rabbitMQBus.subscribe(EventType.DELIVERY_CREATED, "notification_delivery_created", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId } = event.payload;

      // Broadcast to all Delivery Managers that an order needs courier assignment
      await this.notificationService.sendMulticastNotification(
        AppType.DELIVERY_MANAGER,
        "ORDER_READY",
        "notification_delivery_manager_order_ready_title",
        "notification_delivery_manager_order_ready_message",
        { deliveryId, orderId: customerOrderId, type: "ORDER_READY", role: "DELIVERY_MANAGER" },
      );
    });

    await rabbitMQBus.subscribe(EventType.ORDER_READY, "notification_order_ready", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;

      // Notify the Customer
      await this.notificationService.sendNotification(
        customerId,
        "ORDER_UPDATE",
        "notification_order_ready_title",
        "notification_order_ready_message",
        { orderId: customerOrderId, type: "ORDER_UPDATE", role: "CUSTOMER" },
      );

      // We still keep the multicast for Delivery Manager here as a fallback or if no deliveryId yet, 
      // but the DELIVERY_CREATED handler above will provide the deliveryId.
    });

    // 2. Delivery Events
    await rabbitMQBus.subscribe(
      EventType.COURIER_ASSIGNED,
      "notification_courier_assigned",
      async (event: BaseEvent) => {
        const { customerOrderId, customerId, courierUserId, deliveryId } = event.payload;

        // 1. Notify Customer
        await this.notificationService.sendNotification(
          customerId,
          "DELIVERY_UPDATE",
          "notification_courier_assigned_customer_title",
          "notification_courier_assigned_customer_message",
          { orderId: customerOrderId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
        );

        // 2. Notify Courier
        if (courierUserId) {
          await this.notificationService.sendNotification(
            courierUserId,
            "DELIVERY_ASSIGNMENT",
            "notification_courier_assigned_courier_title",
            "notification_courier_assigned_courier_message",
            { deliveryId, orderId: customerOrderId, type: "DELIVERY_ASSIGNMENT", role: "COURIER" },
          );
        }
      },
    );

    await rabbitMQBus.subscribe(EventType.ORDER_PICKED_UP, "notification_order_picked_up", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "DELIVERY_UPDATE",
        "notification_order_picked_up_title",
        "notification_order_picked_up_message",
        { orderId: customerOrderId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
      );
    });

    await rabbitMQBus.subscribe(EventType.ORDER_DELIVERED, "notification_order_delivered", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "DELIVERY_UPDATE",
        "notification_order_delivered_title",
        "notification_order_delivered_message",
        { orderId: customerOrderId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
      );
    });

    // 3. Rating Events
    await rabbitMQBus.subscribe(
      EventType.VENDOR_REVIEW_CREATED,
      "notification_vendor_review_created",
      async (event: BaseEvent) => {
        const { vendorUserId, vendorId, customerName, stars, orderId, ratingId } = event.payload;
        if (vendorUserId) {
          await this.notificationService.sendNotification(
            vendorUserId,
            "NEW_REVIEW",
            "notification_vendor_review_created_title",
            "notification_vendor_review_created_message",
            { vendorId, customerName, stars, orderId, ratingId, type: "NEW_REVIEW", role: "VENDOR" },
          );
        }
      },
    );

    // 4. Inventory Events
    await rabbitMQBus.subscribe(
      EventType.LOW_STOCK,
      "notification_low_stock",
      async (event: BaseEvent) => {
        const { vendorUserId, vendorId, productName, remaining } = event.payload;
        if (vendorUserId) {
          await this.notificationService.sendNotification(
            vendorUserId,
            "LOW_STOCK",
            "notification_low_stock_title",
            "notification_low_stock_message",
            { vendorId, productName, remaining, type: "LOW_STOCK", role: "VENDOR" },
          );
        } else {
          Logger.warn(`[EventConsumer] No vendorUserId provided for LOW_STOCK event on product ${productName} (vendor: ${vendorId})`);
        }
      },
    );

    // 5. User Events
    await rabbitMQBus.subscribe(EventType.USER_REGISTERED, "notification_user_registered", async (event: BaseEvent) => {
      const { userId, name } = event.payload;
      await this.notificationService.sendNotification(
        userId,
        "SYSTEM",
        "notification_user_registered_title",
        "notification_user_registered_message",
        { role: "CUSTOMER", name }
      );
    });

    // 6. SLA Events
    await rabbitMQBus.subscribe(EventType.SLA_VENDOR_CONFIRMATION_EXPIRED, "notification_sla_vendor_confirmation_expired", async (event: BaseEvent) => {
      const { vendorOrderId, customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "ORDER_UPDATE",
        "notification_sla_vendor_cancelled_title",
        "notification_sla_vendor_cancelled_message",
        { orderId: customerOrderId, vendorOrderId, type: "ORDER_UPDATE", role: "CUSTOMER" },
      );
    });

    await rabbitMQBus.subscribe(EventType.SLA_CUSTOMER_DECISION_EXPIRED, "notification_sla_customer_decision_expired", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "ORDER_UPDATE",
        "notification_sla_proposals_auto_accepted_title",
        "notification_sla_proposals_auto_accepted_message",
        { orderId: customerOrderId, type: "ORDER_UPDATE", role: "CUSTOMER" },
      );
    });

    await rabbitMQBus.subscribe(
      EventType.SLA_VENDOR_CANCELLATION_DECISION_EXPIRED,
      "notification_sla_vendor_cancellation_decision_expired",
      async (event: BaseEvent) => {
        const { customerOrderId, customerId } = event.payload;
        await this.notificationService.sendNotification(
          customerId,
          "ORDER_UPDATE",
          "notification_sla_vendor_cancellation_auto_continued_title",
          "notification_sla_vendor_cancellation_auto_continued_message",
          { orderId: customerOrderId, type: "ORDER_UPDATE", role: "CUSTOMER" },
        );
      },
    );

    await rabbitMQBus.subscribe(EventType.SLA_DELIVERY_ACCEPTANCE_EXPIRED, "notification_sla_delivery_acceptance_expired", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId } = event.payload;
      await this.notificationService.sendMulticastNotification(
        AppType.DELIVERY_MANAGER,
        "ORDER_READY",
        "notification_sla_delivery_acceptance_expired_title",
        "notification_sla_delivery_acceptance_expired_message",
        { deliveryId, orderId: customerOrderId, type: "ORDER_READY", role: "DELIVERY_MANAGER" },
      );
    });

    await rabbitMQBus.subscribe(EventType.SLA_COURIER_ASSIGNMENT_EXPIRED, "notification_sla_courier_assignment_expired", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId } = event.payload;
      await this.notificationService.sendMulticastNotification(
        AppType.DELIVERY_MANAGER,
        "ORDER_READY",
        "notification_sla_courier_assignment_expired_title",
        "notification_sla_courier_assignment_expired_message",
        { deliveryId, orderId: customerOrderId, type: "ORDER_READY", role: "DELIVERY_MANAGER" },
      );
    });

    await rabbitMQBus.subscribe(EventType.SLA_COURIER_PICKUP_EXPIRED, "notification_sla_courier_pickup_expired", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId, customerId } = event.payload;
      if (customerId) {
        await this.notificationService.sendNotification(
          customerId,
          "DELIVERY_UPDATE",
          "notification_sla_courier_pickup_expired_title",
          "notification_sla_courier_pickup_expired_message",
          { orderId: customerOrderId, deliveryId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
        );
      }
      await this.notificationService.sendMulticastNotification(
        AppType.DELIVERY_MANAGER,
        "ORDER_READY",
        "notification_sla_courier_pickup_expired_manager_title",
        "notification_sla_courier_pickup_expired_manager_message",
        { deliveryId, orderId: customerOrderId, type: "ORDER_READY", role: "DELIVERY_MANAGER" },
      );
    });

    // 3. Freelance couriers
    await rabbitMQBus.subscribe(EventType.DELIVERY_OPEN_TO_FREELANCE, "notification_delivery_open_to_freelance", async (event: BaseEvent) => {
      // delivery-service already filtered to approved, online freelancers near the pickup
      const { deliveryId, courierUserIds } = event.payload;
      for (const courierUserId of (courierUserIds as string[]) || []) {
        await this.notificationService.sendNotification(
          courierUserId,
          "DELIVERY_POOL",
          "notification_delivery_open_to_freelance_title",
          "notification_delivery_open_to_freelance_message",
          { deliveryId, type: "DELIVERY_POOL", role: "COURIER" },
        );
      }
    });

    await rabbitMQBus.subscribe(EventType.COURIER_APPROVAL_UPDATED, "notification_courier_approval_updated", async (event: BaseEvent) => {
      const { courierId, courierUserId, courierName, approvalStatus, officeUserId } = event.payload;
      const key =
        approvalStatus === "APPROVED"
          ? "notification_courier_approved"
          : approvalStatus === "REJECTED"
            ? "notification_courier_rejected"
            : "notification_courier_suspended";
      await this.notificationService.sendNotification(courierUserId, "ACCOUNT_UPDATE", `${key}_title`, `${key}_message`, {
        type: "ACCOUNT_UPDATE",
        role: "COURIER",
        approvalStatus,
      });
      // Office courier: tell the manager who requested them
      if (officeUserId) {
        const officeKey = `notification_office_courier_${String(approvalStatus).toLowerCase()}`;
        await this.notificationService.sendNotification(officeUserId, "ACCOUNT_UPDATE", `${officeKey}_title`, `${officeKey}_message`, {
          type: "ACCOUNT_UPDATE",
          role: "DELIVERY_MANAGER",
          courierId,
          courierName,
          approvalStatus,
        });
      }
    });

    await rabbitMQBus.subscribe(EventType.OFFICE_APPROVAL_UPDATED, "notification_office_approval_updated", async (event: BaseEvent) => {
      const { officeUserId, approvalStatus } = event.payload;
      const key = approvalStatus === "APPROVED" ? "notification_office_approved" : "notification_office_suspended";
      await this.notificationService.sendNotification(officeUserId, "ACCOUNT_UPDATE", `${key}_title`, `${key}_message`, {
        type: "ACCOUNT_UPDATE",
        role: "DELIVERY_MANAGER",
        approvalStatus,
      });
    });

    await rabbitMQBus.subscribe(EventType.VENDOR_APPROVAL_UPDATED, "notification_vendor_approval_updated", async (event: BaseEvent) => {
      const { vendorUserId, vendorId, approvalStatus } = event.payload;
      const key =
        approvalStatus === "APPROVED" ? "notification_vendor_approved" : approvalStatus === "REJECTED" ? "notification_vendor_rejected" : "notification_vendor_suspended";
      await this.notificationService.sendNotification(vendorUserId, "ACCOUNT_UPDATE", `${key}_title`, `${key}_message`, {
        type: "ACCOUNT_UPDATE",
        role: "VENDOR",
        vendorId,
        approvalStatus,
      });
    });

    // Admin decision on a merchant's new-product proposal. Published once per actual state change
    // (a repeated approval publishes nothing), so a redelivered message is the only duplicate source.
    await rabbitMQBus.subscribe(EventType.PRODUCT_SUBMISSION_REVIEWED, "notification_product_submission_reviewed", async (event: BaseEvent) => {
      const { vendorUserId, vendorId, submissionId, status, productName, vendorProductId } = event.payload;
      const key =
        status === "APPROVED"
          ? "notification_product_submission_approved"
          : status === "REJECTED"
            ? "notification_product_submission_rejected"
            : "notification_product_submission_needs_changes";
      await this.notificationService.sendNotification(vendorUserId, "PRODUCT_SUBMISSION", `${key}_title`, `${key}_message`, {
        type: "PRODUCT_SUBMISSION",
        role: "VENDOR",
        vendorId,
        submissionId,
        status,
        productName,
        vendorProductId: vendorProductId ?? undefined,
      });
    });

    await rabbitMQBus.subscribe(EventType.DELIVERY_RELEASED_BY_COURIER, "notification_delivery_released_by_courier", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId, customerId, officeUserId } = event.payload;
      if (officeUserId) {
        await this.notificationService.sendNotification(
          officeUserId,
          "ORDER_READY",
          "notification_delivery_released_by_courier_title",
          "notification_delivery_released_by_courier_message",
          { deliveryId, orderId: customerOrderId, type: "ORDER_READY", role: "DELIVERY_MANAGER" },
        );
      }
      if (customerId) await this.notifyCustomerCourierChanged(customerId, customerOrderId, deliveryId);
    });

    await rabbitMQBus.subscribe(EventType.DELIVERY_RETURNED_TO_POOL, "notification_delivery_returned_to_pool", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId, customerId, previousCourierId } = event.payload;
      // Office assignment timeouts never showed the customer a courier; nothing changed for them
      if (customerId && previousCourierId) await this.notifyCustomerCourierChanged(customerId, customerOrderId, deliveryId);
    });

    await this.startAdminConsumers();

    Logger.info("Notification Service Consumers Started");
  }

  // ── Admin notifications ──────────────────────────────────────────────────
  // Own queues (notification_admin_*), so a retry of a customer/vendor handler never re-runs these.
  // Every admin gets a stored notification; `push: false` keeps frequent, low-urgency ones in-app.
  // The dedupe key is the source event id, so a redelivered message notifies nobody twice.
  private async startAdminConsumers() {
    const key = (event: BaseEvent, fallback: string) => `${event.type}:${event.id ?? fallback}`;
    const shortOrder = (id?: string) => (id ? String(id).slice(0, 6) : "");

    await rabbitMQBus.subscribe(EventType.VENDOR_REGISTERED, "notification_admin_vendor_registered", async (event: BaseEvent) => {
      const { vendorId, shopName, approvalStatus, resubmitted } = event.payload;
      // Stores created by an admin start APPROVED: nothing to review
      if (approvalStatus !== "PENDING_REVIEW") return;
      const k = resubmitted ? "notification_admin_vendor_resubmitted" : "notification_admin_vendor_registered";
      await this.notificationService.sendToAdmins(
        "ADMIN_VENDOR_REVIEW",
        `${k}_title`,
        `${k}_message`,
        { type: "ADMIN_VENDOR_REVIEW", vendorId, shopName },
        { dedupeKey: key(event, `${vendorId}:${event.timestamp}`) },
      );
    });

    await rabbitMQBus.subscribe(EventType.COURIER_REVIEW_REQUESTED, "notification_admin_courier_review", async (event: BaseEvent) => {
      const { courierId, courierName, courierType, officeName } = event.payload;
      const k = courierType === "FREELANCE" ? "notification_admin_freelancer_review" : "notification_admin_courier_review";
      await this.notificationService.sendToAdmins(
        "ADMIN_COURIER_REVIEW",
        `${k}_title`,
        `${k}_message`,
        { type: "ADMIN_COURIER_REVIEW", courierId, courierName, officeName: officeName ?? "" },
        { dedupeKey: key(event, courierId) },
      );
    });

    await rabbitMQBus.subscribe(EventType.OFFICE_REVIEW_REQUESTED, "notification_admin_office_review", async (event: BaseEvent) => {
      const { officeId, officeName } = event.payload;
      await this.notificationService.sendToAdmins(
        "ADMIN_OFFICE_REVIEW",
        "notification_admin_office_review_title",
        "notification_admin_office_review_message",
        { type: "ADMIN_OFFICE_REVIEW", officeId, officeName },
        { dedupeKey: key(event, officeId) },
      );
    });

    await rabbitMQBus.subscribe(EventType.PRODUCT_SUBMISSION_CREATED, "notification_admin_product_submission", async (event: BaseEvent) => {
      const { submissionId, productName, action, revision } = event.payload;
      // A plain edit of a proposal that is still pending only refreshes the queue
      if (action !== "SUBMITTED" && action !== "RESUBMITTED") return;
      const k = action === "RESUBMITTED" ? "notification_admin_product_resubmission" : "notification_admin_product_submission";
      await this.notificationService.sendToAdmins(
        "ADMIN_PRODUCT_SUBMISSION",
        `${k}_title`,
        `${k}_message`,
        { type: "ADMIN_PRODUCT_SUBMISSION", submissionId, productName },
        // Revision-based: the same proposal version is announced once, whatever the publisher does
        { dedupeKey: `${EventType.PRODUCT_SUBMISSION_CREATED}:${submissionId}:r${revision}` },
      );
    });

    await rabbitMQBus.subscribe(EventType.DELIVERY_FAILED, "notification_admin_delivery_failed", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId, reason } = event.payload;
      await this.notificationService.sendToAdmins(
        "ADMIN_DELIVERY_ISSUE",
        "notification_admin_delivery_failed_title",
        "notification_admin_delivery_failed_message",
        { type: "ADMIN_DELIVERY_ISSUE", deliveryId, customerOrderId, orderId: shortOrder(customerOrderId), reason: reason || "—" },
        { dedupeKey: key(event, deliveryId) },
      );
    });

    await rabbitMQBus.subscribe(EventType.SLA_COURIER_PICKUP_EXPIRED, "notification_admin_sla_pickup_expired", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId } = event.payload;
      await this.notificationService.sendToAdmins(
        "ADMIN_DELIVERY_ISSUE",
        "notification_admin_pickup_expired_title",
        "notification_admin_pickup_expired_message",
        { type: "ADMIN_DELIVERY_ISSUE", deliveryId, customerOrderId, orderId: shortOrder(customerOrderId) },
        { dedupeKey: key(event, deliveryId) },
      );
    });

    await rabbitMQBus.subscribe(EventType.SLA_DELIVERY_ACCEPTANCE_EXPIRED, "notification_admin_sla_acceptance_expired", async (event: BaseEvent) => {
      const { deliveryId, customerOrderId } = event.payload;
      await this.notificationService.sendToAdmins(
        "ADMIN_DELIVERY_ISSUE",
        "notification_admin_acceptance_expired_title",
        "notification_admin_acceptance_expired_message",
        { type: "ADMIN_DELIVERY_ISSUE", deliveryId, customerOrderId, orderId: shortOrder(customerOrderId) },
        { dedupeKey: key(event, deliveryId), push: false },
      );
    });

    await rabbitMQBus.subscribe(EventType.SLA_VENDOR_CONFIRMATION_EXPIRED, "notification_admin_sla_vendor_confirmation", async (event: BaseEvent) => {
      const { vendorOrderId, customerOrderId } = event.payload;
      await this.notificationService.sendToAdmins(
        "ADMIN_ORDER_ISSUE",
        "notification_admin_vendor_confirmation_expired_title",
        "notification_admin_vendor_confirmation_expired_message",
        { type: "ADMIN_ORDER_ISSUE", customerOrderId, vendorOrderId, orderId: shortOrder(customerOrderId) },
        { dedupeKey: key(event, vendorOrderId) },
      );
    });

    // A new order sends one VENDOR_ORDER_CREATED per store, so the key is the customer order:
    // a split order is announced once.
    await rabbitMQBus.subscribe(EventType.VENDOR_ORDER_CREATED, "notification_admin_new_order", async (event: BaseEvent) => {
      const { customerOrderId } = event.payload;
      if (!customerOrderId) return;
      await this.notificationService.sendToAdmins(
        "ADMIN_NEW_ORDER",
        "notification_admin_new_order_title",
        "notification_admin_new_order_message",
        { type: "ADMIN_NEW_ORDER", customerOrderId, orderId: shortOrder(customerOrderId) },
        { dedupeKey: `ADMIN_NEW_ORDER:${customerOrderId}` },
      );
    });

    // Published by both the state manager and the cancel paths; an order is cancelled once
    await rabbitMQBus.subscribe(EventType.ORDER_CANCELLED, "notification_admin_order_cancelled", async (event: BaseEvent) => {
      const { customerOrderId } = event.payload;
      if (!customerOrderId) return;
      await this.notificationService.sendToAdmins(
        "ADMIN_ORDER_CANCELLED",
        "notification_admin_order_cancelled_title",
        "notification_admin_order_cancelled_message",
        { type: "ADMIN_ORDER_CANCELLED", customerOrderId, orderId: shortOrder(customerOrderId) },
        { dedupeKey: `ADMIN_ORDER_CANCELLED:${customerOrderId}` },
      );
    });
  }

  // The courier the customer saw (and may have called) is gone; a new one is being found.
  private async notifyCustomerCourierChanged(customerId: string, customerOrderId: string, deliveryId: string) {
    await this.notificationService.sendNotification(
      customerId,
      "DELIVERY_UPDATE",
      "notification_courier_changed_title",
      "notification_courier_changed_message",
      { orderId: customerOrderId, deliveryId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
    );
  }
}
