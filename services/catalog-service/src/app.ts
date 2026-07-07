import express from "express";
import cors from "cors";
import { createVendorProductRoutes } from "./presentation/routes/vendor-product.routes";
import { createCategoryRoutes } from "./presentation/routes/category.routes";
import { createGlobalProductRoutes } from "./presentation/routes/global-product.routes";
import { VendorProductController } from "./presentation/controllers/vendor-product.controller";
import { CategoryController } from "./presentation/controllers/category.controller";
import { GlobalProductController } from "./presentation/controllers/global-product.controller";
import { CatalogService } from "./application/services/catalog.service";
import { CategoryService } from "./application/services/category.service";
import { VendorProductRepository } from "./infrastructure/repositories/vendor-product.repository";
import { GlobalProductRepository } from "./infrastructure/repositories/global-product.repository";
import { CategoryRepository } from "./infrastructure/repositories/category.repository";
import { errorHandler, Database, authenticate, rabbitMQBus } from "@city-market/shared/node";
import { EventType } from "@city-market/shared";
import { config } from "./config/env";
import { OrderDeliveredConsumer } from "./application/events/order-delivered.consumer";
import { OrderStockCheckConsumer } from "./application/events/order-stock-check.consumer";
import { OrderStockReleaseConsumer } from "./application/events/order-stock-release.consumer";

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

  const vendorProductRepo = new VendorProductRepository(db);
  const globalProductRepo = new GlobalProductRepository(db);
  const categoryRepo = new CategoryRepository(db);

  const catalogService = new CatalogService(vendorProductRepo, categoryRepo, globalProductRepo);
  const categoryService = new CategoryService(categoryRepo);

  const vendorProductController = new VendorProductController(catalogService);
  const categoryController = new CategoryController(categoryService);
  const globalProductController = new GlobalProductController(catalogService);

  const orderDeliveredConsumer = new OrderDeliveredConsumer(catalogService);
  const orderStockCheckConsumer = new OrderStockCheckConsumer(catalogService);
  const orderStockReleaseConsumer = new OrderStockReleaseConsumer(catalogService);

  rabbitMQBus.subscribe(EventType.ORDER_DELIVERED, "catalog_service_order_delivered", (event) =>
    orderDeliveredConsumer.handle(event),
  );

  rabbitMQBus.subscribe(EventType.ORDER_STOCK_CHECK_REQUESTED, "catalog_service_stock_check", (event) =>
    orderStockCheckConsumer.handle(event),
  );

  rabbitMQBus.subscribe(EventType.ORDER_STOCK_RELEASE_REQUESTED, "catalog_service_stock_release", (event) =>
    orderStockReleaseConsumer.handle(event),
  );

  app.use(authenticate);

  app.use("/", createVendorProductRoutes(vendorProductController));
  app.use("/", createCategoryRoutes(categoryController));
  app.use("/", createGlobalProductRoutes(globalProductController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "catalog-service" });
  });

  app.use(errorHandler);

  return app;
};
