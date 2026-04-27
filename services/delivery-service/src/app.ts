import express from "express";
import cors from "cors";
import { createDeliveryRoutes } from "./presentation/routes/delivery.routes";
import { createCourierSettlementRoutes } from "./presentation/routes/courier-settlement.routes";
import { createDeliveryOfficeSettlementRoutes } from "./presentation/routes/delivery-office-settlement.routes";
import { createDeliveryFeeTierRoutes } from "./presentation/routes/delivery-fee-tier.routes";
import { DeliveryController } from "./presentation/controllers/delivery.controller";
import { CourierSettlementController } from "./presentation/controllers/courier-settlement.controller";
import { DeliveryOfficeSettlementController } from "./presentation/controllers/delivery-office-settlement.controller";
import { DeliveryFeeTierController } from "./presentation/controllers/delivery-fee-tier.controller";
import { DeliveryService } from "./application/services/delivery.service";
import { CourierSettlementService } from "./application/services/courier-settlement.service";
import { DeliveryOfficeSettlementService } from "./application/services/delivery-office-settlement.service";
import { DeliveryFeeTierService } from "./application/services/delivery-fee-tier.service";
import { CourierRepository } from "./infrastructure/repositories/courier.repository";
import { DeliveryRepository } from "./infrastructure/repositories/delivery.repository";
import { CourierSettlementRepository } from "./infrastructure/repositories/courier-settlement.repository";
import { DeliveryOfficeSettlementRepository } from "./infrastructure/repositories/delivery-office-settlement.repository";
import { DeliveryOfficeRepository } from "./infrastructure/repositories/delivery-office.repository";
import { DeliveryFeeTierRepository } from "./infrastructure/repositories/delivery-fee-tier.repository";
import { errorHandler, Database, authenticate, rabbitMQBus, correlation } from "@city-market/shared/node";
import { EventType } from "@city-market/shared";
import { OrderReadyConsumer } from "./application/events/order-ready.consumer";
import { OrderHttpClient } from "./infrastructure/http/order-http-client";
import { VendorHttpClient } from "./infrastructure/http/vendor-http-client";
import { UserHttpClient } from "./infrastructure/http/user-http-client";
import { DeliveryPublisher } from "./infrastructure/messaging/DeliveryPublisher";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  app.use(correlation);
  app.use(cors());
  app.use(express.json());

  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  const courierRepo = new CourierRepository(db);
  const deliveryRepo = new DeliveryRepository(db);
  const settlementRepo = new CourierSettlementRepository(db);
  const deliveryOfficeRepo = new DeliveryOfficeRepository(db);
  const feeTierRepo = new DeliveryFeeTierRepository(db);

  const orderClient = new OrderHttpClient(config.orderServiceUrl);
  const vendorClient = new VendorHttpClient(config.vendorServiceUrl);
  const userClient = new UserHttpClient(config.userServiceUrl);
  const publisher = new DeliveryPublisher(rabbitMQBus);

  const deliveryService = new DeliveryService(
    courierRepo,
    deliveryRepo,
    publisher,
    orderClient,
    vendorClient,
    userClient,
    db,
    config.assignedWindowMinutes,
    feeTierRepo,
    deliveryOfficeRepo,
  );

  const deliveryController = new DeliveryController(deliveryService);

  const officeSettlementRepo = new DeliveryOfficeSettlementRepository(db);

  const settlementService = new CourierSettlementService(settlementRepo, deliveryRepo, deliveryOfficeRepo, courierRepo, db);
  const settlementController = new CourierSettlementController(settlementService);

  const officeSettlementService = new DeliveryOfficeSettlementService(officeSettlementRepo, deliveryOfficeRepo, deliveryRepo, db);
  const officeSettlementController = new DeliveryOfficeSettlementController(officeSettlementService);

  // Cancel deliveries that exceeded the courier assignment window
  const EXPIRY_CHECK_INTERVAL_MS = 60_000;
  setInterval(() => {
    deliveryService.cancelExpiredAssignedDeliveries().catch((err) =>
      console.error("[DeliveryService] Assignment expiry check failed:", err.message),
    );
  }, EXPIRY_CHECK_INTERVAL_MS);

  // Register Event Consumers
  const orderReadyConsumer = new OrderReadyConsumer(deliveryService);
  rabbitMQBus.subscribe(EventType.ORDER_READY, "delivery_service_order_ready", (event) =>
    orderReadyConsumer.handle(event)
  );

  app.use(authenticate);

  const feeTierService = new DeliveryFeeTierService(feeTierRepo);
  const feeTierController = new DeliveryFeeTierController(feeTierService);

  app.use("/", createDeliveryRoutes(deliveryController, deliveryOfficeRepo));
  app.use("/courier-settlements", createCourierSettlementRoutes(settlementController));
  app.use("/office-settlements", createDeliveryOfficeSettlementRoutes(officeSettlementController));
  app.use("/delivery-fee-tiers", createDeliveryFeeTierRoutes(feeTierController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "delivery-service" });
  });

  app.use(errorHandler);

  return app;
};
