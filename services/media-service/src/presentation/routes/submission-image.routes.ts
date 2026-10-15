import { Router } from "express";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";
import { SubmissionImageController } from "../controllers/submission-image.controller";
import { submissionImageUpload } from "../middlewares/upload.middleware";
import { userRateLimit } from "../middlewares/user-rate-limit.middleware";

export interface SubmissionImageRouteOptions {
  maxBytes: number;
  uploadLimit: number;
  uploadWindowMs: number;
}

export const createSubmissionImageRoutes = (controller: SubmissionImageController, options: SubmissionImageRouteOptions): Router => {
  const router = Router();

  // Rules the apps show next to the picker (and pre-check before uploading)
  router.get("/media/submission-images/rules", controller.rules);

  // POST /media/submission-images — multipart: file. Merchants only; stored privately.
  router.post(
    "/media/submission-images",
    authorize(UserRole.VENDOR),
    userRateLimit(options.uploadLimit, options.uploadWindowMs),
    submissionImageUpload(options.maxBytes),
    controller.upload,
  );

  // catalog-service only (checked in the controller)
  router.post("/media/private/stat", controller.stat);
  router.post("/media/private/signed-urls", controller.signedUrls);
  router.post("/media/private/promote", controller.promote);
  router.post("/media/private/list", controller.list);
  router.delete("/media/private", controller.remove);

  return router;
};
