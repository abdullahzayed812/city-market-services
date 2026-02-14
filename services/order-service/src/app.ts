import express from "express";
import { createOrderRoutes } from "./presentation/routes/order.routes";
import { OrderController } from "./presentation/controllers/order.controller";
import { OrderService } from "./application/services/order.service";
import { CustomerOrderRepository } from "./infrastructure/repositories/customer-order.repository";
import { VendorOrderRepository } from "./infrastructure/repositories/vendor-order.repository";
import { VendorOrderItemRepository } from "./infrastructure/repositories/vendor-order-item.repository";
import { OrderItemProposalRepository } from "./infrastructure/repositories/order-item-proposal.repository";
import { OrderStatusHistoryRepository } from "./infrastructure/repositories/order-status-history.repository";
import { CatalogHttpClient } from "./infrastructure/http/catalog-http-client";
import { VendorHttpClient } from "./infrastructure/http/vendor-http-client";
import { EventType } from "@city-market/shared";
import { errorHandler, Database, rabbitMQBus } from "@city-market/shared/node";
import { DeliveryUpdatedConsumer } from "./application/events/delivery-updated.consumer";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  app.use(express.json());

  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  const customerOrderRepo = new CustomerOrderRepository(db);
  const vendorOrderRepo = new VendorOrderRepository(db);
  const vendorOrderItemRepo = new VendorOrderItemRepository(db);
  const proposalRepo = new OrderItemProposalRepository(db);
  const statusHistoryRepo = new OrderStatusHistoryRepository(db);
  const catalogClient = new CatalogHttpClient(config.catalogServiceUrl);
  const vendorClient = new VendorHttpClient(config.vendorServiceUrl);

  const orderService = new OrderService(
    customerOrderRepo,
    vendorOrderRepo,
    vendorOrderItemRepo,
    proposalRepo,
    statusHistoryRepo,
    catalogClient,
    vendorClient,
    rabbitMQBus,
    db
  );

  const orderController = new OrderController(orderService);

  const deliveryUpdatedConsumer = new DeliveryUpdatedConsumer(orderService);
  rabbitMQBus.subscribe(EventType.ORDER_PICKED_UP, "order_service_pickup", (event) => deliveryUpdatedConsumer.handle(event));
  rabbitMQBus.subscribe(EventType.ORDER_ON_THE_WAY, "order_service_ontheway", (event) => deliveryUpdatedConsumer.handle(event));
  rabbitMQBus.subscribe(EventType.ORDER_DELIVERED, "order_service_delivered", (event) => deliveryUpdatedConsumer.handle(event));

  app.use("/", createOrderRoutes(orderController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "order-service" });
  });

  app.use(errorHandler);

  return app;
};
