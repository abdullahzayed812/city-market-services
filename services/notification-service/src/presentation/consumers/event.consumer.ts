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
        { orderId: customerOrderId, role: "CUSTOMER" },
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
            { orderId: vendorOrderId, customerOrderId, role: "VENDOR" },
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
          { orderId: customerOrderId, role: "CUSTOMER" },
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

      // Fix: Broadcast to all Delivery Managers that an order needs courier assignment
      await this.notificationService.sendMulticastNotification(
        AppType.DELIVERY_MANAGER,
        "ORDER_READY",
        "notification_delivery_manager_order_ready_title",
        "notification_delivery_manager_order_ready_message",
        { orderId: customerOrderId, type: "ORDER_READY", role: "DELIVERY_MANAGER" },
      );
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
            { deliveryId, orderId: customerOrderId, type: "DELIVERY_UPDATE", role: "COURIER" },
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

    // 3. User Events
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

    Logger.info("Notification Service Consumers Started");
  }
}
