import express from "express";
import cors from "cors";
import { createUserRoutes } from "./presentation/routes/user.routes";
import { UserController } from "./presentation/controllers/user.controller";
import { UserService } from "./application/services/user.service";
import { CustomerRepository } from "./infrastructure/repositories/customer.repository";
import { AddressRepository } from "./infrastructure/repositories/address.repository";
import { errorHandler, Database, authenticate, correlation } from "@city-market/shared/node";
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

  const customerRepo = new CustomerRepository(db);
  const addressRepo = new AddressRepository(db);

  const userService = new UserService(customerRepo, addressRepo);

  const userController = new UserController(userService);

  app.use(authenticate);

  app.use("/", createUserRoutes(userController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "user-service" });
  });

  app.use(errorHandler);

  return app;
};
