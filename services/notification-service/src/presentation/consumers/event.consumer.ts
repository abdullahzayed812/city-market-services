import { NotificationService } from "../../application/services/notification.service";
import { rabbitMQBus, Logger } from "@city-market/shared/node";
import { BaseEvent, EventType } from "@city-market/shared";

export class EventConsumer {
  constructor(private notificationService: NotificationService) {}

  async start() {
    // 1. Order Events
    await rabbitMQBus.subscribe(EventType.ORDER_CREATED, "notification_order_created", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "ORDER_CREATED",
        "Order Placed",
        `Your order #${customerOrderId} has been placed successfully.`,
        { orderId: customerOrderId, role: "CUSTOMER" },
      );
    });

    await rabbitMQBus.subscribe(
      EventType.VENDOR_ORDER_CREATED,
      "notification_vendor_order_created",
      async (event: BaseEvent) => {
        const { vendorOrderId, vendorId, customerOrderId } = event.payload;
        await this.notificationService.sendNotification(
          vendorId,
          "ORDER_CREATED",
          "New Order Received",
          `You have a new order #${vendorOrderId} from customer order #${customerOrderId}`,
          { orderId: vendorOrderId, customerOrderId, role: "VENDOR" },
        );
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
          "Order Item Confirmed",
          `An item in your order #${customerOrderId} has been confirmed by the vendor.`,
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
          "Order Changes Proposed",
          `A vendor has proposed changes to your order #${customerOrderId}. Please review.`,
          { orderId: customerOrderId, type: "ORDER_CHANGES_PROPOSED", role: "CUSTOMER" },
        );
      },
    );

    await rabbitMQBus.subscribe(EventType.ORDER_READY, "notification_order_ready", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "ORDER_UPDATE",
        "Order Ready",
        `Your order #${customerOrderId} is ready and waiting for a courier!`,
        { orderId: customerOrderId, type: "ORDER_UPDATE", role: "CUSTOMER" },
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
          "Courier Assigned",
          `A courier has been assigned to your order #${customerOrderId}.`,
          { orderId: customerOrderId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
        );

        // 2. Notify Courier
        if (courierUserId) {
          await this.notificationService.sendNotification(
            courierUserId,
            "DELIVERY_ASSIGNMENT",
            "New Delivery Assigned",
            `You have been assigned a new delivery for order #${customerOrderId}.`,
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
        "Order Picked Up",
        `Your order #${customerOrderId} is on the way!`,
        { orderId: customerOrderId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
      );
    });

    await rabbitMQBus.subscribe(EventType.ORDER_DELIVERED, "notification_order_delivered", async (event: BaseEvent) => {
      const { customerOrderId, customerId } = event.payload;
      await this.notificationService.sendNotification(
        customerId,
        "DELIVERY_UPDATE",
        "Order Delivered",
        `Your order #${customerOrderId} has been delivered. Enjoy!`,
        { orderId: customerOrderId, type: "DELIVERY_UPDATE", role: "CUSTOMER" },
      );
    });

    // 3. User Events
    await rabbitMQBus.subscribe(EventType.USER_REGISTERED, "notification_user_registered", async (event: BaseEvent) => {
      const { userId, name } = event.payload;
      // Initialize preferences (handled implicitly by sendNotification logic or explicit init)
      await this.notificationService.sendNotification(userId, "SYSTEM", "Welcome!", `Welcome to CityMarket, ${name}!`, {
        role: "CUSTOMER",
      });
    });

    Logger.info("Notification Service Consumers Started");
  }
}
