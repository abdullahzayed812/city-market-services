import express from "express";
import cors from "cors";
import { createMediaRoutes } from "./presentation/routes/media.routes";
import { MediaController } from "./presentation/controllers/media.controller";
import { MediaService } from "./application/services/media.service";
import { ImageOptimizerService } from "./application/services/image-optimizer.service";
import { R2StorageService } from "./infrastructure/storage/r2-storage.service";
import { R2PrivateStorageService } from "./infrastructure/storage/r2-private-storage.service";
import { SubmissionImageService } from "./application/services/submission-image.service";
import { parseFormats } from "./application/services/submission-image.validator";
import { SubmissionImageController } from "./presentation/controllers/submission-image.controller";
import { createSubmissionImageRoutes } from "./presentation/routes/submission-image.routes";
import { errorHandler, authenticate, Logger } from "@city-market/shared/node";
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

  // Product-proposal photos live in a bucket without public access. The public bucket is
  // only used as a stand-in when explicitly allowed (development).
  const privateBucket = config.r2PrivateBucket || (config.allowPublicBucketForSubmissions ? config.r2Bucket : "");
  if (!config.r2PrivateBucket) {
    Logger.warn(
      config.allowPublicBucketForSubmissions
        ? "[media] R2_PRIVATE_BUCKET not set: proposal photos go to the PUBLIC bucket (development only)"
        : "[media] R2_PRIVATE_BUCKET not set: product-proposal photo uploads are disabled",
    );
  }
  const privateStorage = new R2PrivateStorageService({
    endpoint: config.r2Endpoint,
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
    bucket: privateBucket,
  });
  const submissionImageService = new SubmissionImageService(
    privateStorage,
    mediaService,
    {
      formats: parseFormats(config.submissionImageFormats),
      minWidth: config.submissionImageMinWidth,
      minHeight: config.submissionImageMinHeight,
      maxBytes: config.submissionImageMaxBytes,
      maxPixels: config.submissionImageMaxPixels,
      outputMaxSide: config.submissionImageOutputMaxSide,
    },
    config.privateSignedUrlTtlSeconds,
  );
  const submissionImageController = new SubmissionImageController(submissionImageService);

  app.use(authenticate);
  app.use("/", createMediaRoutes(mediaController));
  app.use(
    "/",
    createSubmissionImageRoutes(submissionImageController, {
      maxBytes: config.submissionImageMaxBytes,
      uploadLimit: config.submissionUploadLimit,
      uploadWindowMs: config.submissionUploadWindowMs,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", service: "media-service" });
  });

  app.use(errorHandler);

  return app;
};
