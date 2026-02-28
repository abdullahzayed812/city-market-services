import express from "express";
import cors from "cors";
import path from "path";
import { createProductRoutes } from "./presentation/routes/product.routes";
import { createCategoryRoutes } from "./presentation/routes/category.routes";
import { ProductController } from "./presentation/controllers/product.controller";
import { CategoryController } from "./presentation/controllers/category.controller";
import { ProductService } from "./application/services/product.service";
import { CategoryService } from "./application/services/category.service";
import { ProductRepository } from "./infrastructure/repositories/product.repository";
import { CategoryRepository } from "./infrastructure/repositories/category.repository";
import { errorHandler, Database, authenticate } from "@city-market/shared/node";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  const productRepo = new ProductRepository(db);
  const categoryRepo = new CategoryRepository(db);

  const productService = new ProductService(productRepo, categoryRepo);
  const categoryService = new CategoryService(categoryRepo);

  const productController = new ProductController(productService);
  const categoryController = new CategoryController(categoryService);

  app.use(authenticate);

  app.use("/", createProductRoutes(productController));
  app.use("/", createCategoryRoutes(categoryController));

  app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "catalog-service" });
  });

  app.use(errorHandler);

  return app;
};
