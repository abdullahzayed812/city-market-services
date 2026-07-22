import { Router } from "express";
import { MediaController } from "../controllers/media.controller";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";
import { uploadMemory } from "../middlewares/upload.middleware";

export const createMediaRoutes = (controller: MediaController): Router => {
  const router = Router();

  // POST /media/upload  — multipart/form-data: file, folder, entityId
  router.post(
    "/media/upload",
    authorize(UserRole.VENDOR, UserRole.ADMIN),
    uploadMemory.single("file"),
    controller.upload,
  );

  // POST /media/upload-from-url  — body: { imageUrl, folder, entityId } — admin only (bulk import)
  router.post(
    "/media/upload-from-url",
    authorize(UserRole.ADMIN),
    controller.uploadFromUrl,
  );

  // DELETE /media/file  — body: { key: string }
  router.delete(
    "/media/file",
    authorize(UserRole.VENDOR, UserRole.ADMIN),
    controller.deleteFile,
  );

  // DELETE /media/folder  — body: { folder, entityId }
  router.delete(
    "/media/folder",
    authorize(UserRole.ADMIN),
    controller.deleteFolder,
  );

  return router;
};
