import express from "express";
import cors from "cors";
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
import { UserHttpClient } from "./infrastructure/http/user-http-client";
import { OrderPublisher } from "./infrastructure/messaging/OrderPublisher";
import { EventType } from "@city-market/shared";
import { errorHandler, Database, rabbitMQBus, authenticate, createSlaWorker } from "@city-market/shared/node";
import { DeliveryUpdatedConsumer } from "./application/events/delivery-updated.consumer";
import { DeliveryCancelledByCourierConsumer } from "./application/events/delivery-cancelled-by-courier.consumer";
import { StockReservedConsumer } from "./application/events/stock-reserved.consumer";
import { StockRejectedConsumer } from "./application/events/stock-rejected.consumer";
import { config } from "./config/env";
import { CommissionTierRepository } from "./infrastructure/repositories/commission-tier.repository";
import { CommissionTierService } from "./application/services/commission-tier.service";
import { CommissionTierController } from "./presentation/controllers/commission-tier.controller";
import { createCommissionTierRoutes } from "./presentation/routes/commission-tier.routes";
import { SettlementRepository } from "./infrastructure/repositories/settlement.repository";
import { SettlementService } from "./application/services/settlement.service";
import { SettlementController } from "./presentation/controllers/settlement.controller";
import { createSettlementRoutes } from "./presentation/routes/settlement.routes";
import { OrderSlaManager } from "./application/services/order-sla.manager";
import { OrderSlaWorker } from "./application/workers/sla.worker";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : true,
      credentials: true,
    }),
  );
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
  const userClient = new UserHttpClient(config.userServiceUrl);
  const publisher = new OrderPublisher(rabbitMQBus);

  const commissionTierRepo = new CommissionTierRepository(db);
  const commissionTierService = new CommissionTierService(commissionTierRepo);
  const commissionTierController = new CommissionTierController(commissionTierService);

  const settlementRepo = new SettlementRepository(db);
  const settlementService = new SettlementService(settlementRepo, vendorOrderRepo, db);
  const settlementController = new SettlementController(settlementService);

  const orderService = new OrderService(
    customerOrderRepo,
    vendorOrderRepo,
    vendorOrderItemRepo,
    proposalRepo,
    statusHistoryRepo,
    catalogClient,
    vendorClient,
    publisher,
    commissionTierService,
    db,
    userClient,
  );

  const parsedRedisUrl = new URL(config.redisUrl || "redis://localhost:6379");
  const redisConnection = { host: parsedRedisUrl.hostname || "localhost", port: parseInt(parsedRedisUrl.port || "6379", 10), password: parsedRedisUrl.password || undefined };

  const slaManager = new OrderSlaManager(vendorOrderRepo, publisher, config.redisUrl, config.vendorConfirmationSlaMins, config.customerDecisionSlaMins);
  orderService.stateManager.setSlaManager(slaManager);

  const slaWorkerInstance = new OrderSlaWorker(
    vendorOrderRepo,
    customerOrderRepo,
    proposalRepo,
    statusHistoryRepo,
    vendorOrderItemRepo,
    publisher,
    orderService.stateManager,
    (orderService as any).proposalManager,
    db,
  );

  createSlaWorker("sla-order", (job) => slaWorkerInstance.handle(job), redisConnection);

  // Run startup recovery after a short delay to let the DB pool warm up
  setTimeout(() => slaManager.runStartupRecovery((job) => slaWorkerInstance.handle(job)).catch(console.error), 5000);

  const orderController = new OrderController(orderService);

  const deliveryUpdatedConsumer = new DeliveryUpdatedConsumer(orderService);
  const deliveryCancelledConsumer = new DeliveryCancelledByCourierConsumer(orderService);
  const stockReservedConsumer = new StockReservedConsumer(db, customerOrderRepo, vendorOrderRepo, orderService.stateManager, publisher);
  const stockRejectedConsumer = new StockRejectedConsumer(db, customerOrderRepo, vendorOrderRepo, orderService.stateManager);

  rabbitMQBus.subscribe(EventType.ORDER_PICKED_UP, "order_service_pickup", (event) => deliveryUpdatedConsumer.handle(event));
  rabbitMQBus.subscribe(EventType.ORDER_ON_THE_WAY, "order_service_ontheway", (event) => deliveryUpdatedConsumer.handle(event));
  rabbitMQBus.subscribe(EventType.ORDER_DELIVERED, "order_service_delivered", (event) => deliveryUpdatedConsumer.handle(event));
  rabbitMQBus.subscribe(EventType.DELIVERY_FAILED, "order_service_delivery_failed", (event) => deliveryUpdatedConsumer.handle(event));
  rabbitMQBus.subscribe(EventType.DELIVERY_CANCELLED_BY_COURIER, "order_service_delivery_cancelled_by_courier", (event) =>
    deliveryCancelledConsumer.handle(event),
  );

  rabbitMQBus.subscribe(EventType.STOCK_RESERVED, "order_service_stock_reserved", (event) => stockReservedConsumer.handle(event));
  rabbitMQBus.subscribe(EventType.STOCK_REJECTED, "order_service_stock_rejected", (event) => stockRejectedConsumer.handle(event));

  // SLA timers handled by BullMQ — see OrderSlaManager and OrderSlaWorker above

  app.use(authenticate);

  app.use("/", createOrderRoutes(orderController));
  app.use("/commission-tiers", createCommissionTierRoutes(commissionTierController));
  app.use("/settlements", createSettlementRoutes(settlementController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "order-service" });
  });

  app.use(errorHandler);

  return app;
};
