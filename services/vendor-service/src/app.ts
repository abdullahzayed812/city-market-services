import express from "express";
import path from "path";
import { createVendorRoutes } from "./presentation/routes/vendor.routes";
import { VendorController } from "./presentation/controllers/vendor.controller";
import { VendorService } from "./application/services/vendor.service";
import { VendorRepository } from "./infrastructure/repositories/vendor.repository";
import { WorkingHoursRepository } from "./infrastructure/repositories/working-hours.repository";
import { errorHandler, Database, authenticate } from "@city-market/shared/node";
import { eventBus } from "@city-market/shared";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  const vendorRepo = new VendorRepository(db);
  const workingHoursRepo = new WorkingHoursRepository(db);

  const vendorService = new VendorService(vendorRepo, workingHoursRepo, eventBus);

  const vendorController = new VendorController(vendorService);

  app.use(authenticate);

  app.use("/", createVendorRoutes(vendorController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "vendor-service" });
  });

  app.use(errorHandler);

  return app;
};
