import express from "express";
import cors from "cors";
import { createMediaRoutes } from "./presentation/routes/media.routes";
import { MediaController } from "./presentation/controllers/media.controller";
import { MediaService } from "./application/services/media.service";
import { ImageOptimizerService } from "./application/services/image-optimizer.service";
import { R2StorageService } from "./infrastructure/storage/r2-storage.service";
import { errorHandler, authenticate } from "@city-market/shared/node";
import { config } from "./config/env";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : true,
      credentials: true,
    }),
  );
  app.use(express.json());

  const storage = new R2StorageService({
    endpoint: config.r2Endpoint,
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
    bucket: config.r2Bucket,
    cdnUrl: config.cdnUrl,
  });

  const optimizer = new ImageOptimizerService();
  const mediaService = new MediaService(storage, optimizer);
  const mediaController = new MediaController(mediaService);

  app.use(authenticate);
  app.use("/", createMediaRoutes(mediaController));

  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", service: "media-service" });
  });

  app.use(errorHandler);

  return app;
};
