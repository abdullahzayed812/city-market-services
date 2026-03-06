import express from "express";
import cors from "cors";
import { createDeliveryRoutes } from "./presentation/routes/delivery.routes";
import { DeliveryController } from "./presentation/controllers/delivery.controller";
import { DeliveryService } from "./application/services/delivery.service";
import { CourierRepository } from "./infrastructure/repositories/courier.repository";
import { DeliveryRepository } from "./infrastructure/repositories/delivery.repository";
import { errorHandler, Database, authenticate } from "@city-market/shared/node";
import { EventType } from "@city-market/shared";
import { rabbitMQBus } from "@city-market/shared/node";
import { OrderReadyConsumer } from "./application/events/order-ready.consumer";
import { OrderHttpClient } from "./infrastructure/http/order-http-client";
import { VendorHttpClient } from "./infrastructure/http/vendor-http-client";
import { DeliveryPublisher } from "./infrastructure/messaging/DeliveryPublisher";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

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

  const orderClient = new OrderHttpClient(config.orderServiceUrl);
  const vendorClient = new VendorHttpClient(config.vendorServiceUrl);
  const publisher = new DeliveryPublisher(rabbitMQBus);

  const deliveryService = new DeliveryService(
    courierRepo,
    deliveryRepo,
    publisher,
    orderClient,
    vendorClient,
    db // Added
  );

  const deliveryController = new DeliveryController(deliveryService);

  // Register Event Consumers
  const orderReadyConsumer = new OrderReadyConsumer(deliveryService);
  rabbitMQBus.subscribe(EventType.ORDER_READY, "delivery_service_order_ready", (event) =>
    orderReadyConsumer.handle(event)
  );

  app.use(authenticate);

  app.use("/", createDeliveryRoutes(deliveryController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "delivery-service" });
  });

  app.use(errorHandler);

  return app;
};
