import express from "express";
import cors from "cors";
import { createUserRoutes } from "./presentation/routes/user.routes";
import { UserController } from "./presentation/controllers/user.controller";
import { UserService } from "./application/services/user.service";
import { CustomerRepository } from "./infrastructure/repositories/customer.repository";
import { AddressRepository } from "./infrastructure/repositories/address.repository";
import { CustomerPenaltyRepository } from "./infrastructure/repositories/customer-penalty.repository";
import { DeliveryCancelledByCourierConsumer } from "./application/events/delivery-cancelled-by-courier.consumer";
import { EventType } from "@city-market/shared";
import { errorHandler, Database, rabbitMQBus, authenticate, correlation } from "@city-market/shared/node";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  app.use(correlation);
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

  const customerRepo = new CustomerRepository(db);
  const addressRepo = new AddressRepository(db);
  const penaltyRepo = new CustomerPenaltyRepository(db);

  const userService = new UserService(customerRepo, addressRepo, penaltyRepo);

  const userController = new UserController(userService);

  const deliveryCancelledConsumer = new DeliveryCancelledByCourierConsumer(userService);

  rabbitMQBus.subscribe(EventType.DELIVERY_CANCELLED_BY_COURIER, "user_service_delivery_cancelled_by_courier", (event) =>
    deliveryCancelledConsumer.handle(event),
  );

  app.use(authenticate);

  app.use("/", createUserRoutes(userController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "user-service" });
  });

  app.use(errorHandler);

  return app;
};
