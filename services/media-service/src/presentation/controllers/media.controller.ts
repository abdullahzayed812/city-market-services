import { Response, NextFunction } from "express";
import { MediaService } from "../../application/services/media.service";
import { ApiResponse, ValidationError } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { MediaFolder, ALLOWED_FOLDERS } from "../../core/entities/media.entity";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  upload = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new ValidationError("no_file_provided");

      const { folder, entityId } = req.body as { folder: string; entityId: string };

      if (!folder || !(ALLOWED_FOLDERS as readonly string[]).includes(folder)) {
        throw new ValidationError(
          "invalid_folder_allowed_products_categories_vendors_globals",
        );
      }

      if (!entityId || !UUID_REGEX.test(entityId)) {
        throw new ValidationError("entity_id_must_be_a_valid_uuid");
      }

      const result = await this.mediaService.uploadImage(
        req.file.buffer,
        folder as MediaFolder,
        entityId,
      );

      res.status(201).json(ApiResponse.success(result, "media_uploaded"));
    } catch (error) {
      next(error);
    }
  };

  uploadFromUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { imageUrl, folder, entityId } = req.body as {
        imageUrl?: string;
        folder?: string;
        entityId?: string;
      };

      if (!imageUrl || typeof imageUrl !== "string") {
        throw new ValidationError("image_url_required");
      }

      if (!folder || !(ALLOWED_FOLDERS as readonly string[]).includes(folder)) {
        throw new ValidationError(
          "invalid_folder_allowed_products_categories_vendors_globals",
        );
      }

      if (!entityId || !UUID_REGEX.test(entityId)) {
        throw new ValidationError("entity_id_must_be_a_valid_uuid");
      }

      const result = await this.mediaService.uploadImageFromUrl(
        imageUrl,
        folder as MediaFolder,
        entityId,
      );

      res.status(201).json(ApiResponse.success(result, "media_uploaded"));
    } catch (error) {
      next(error);
    }
  };

  deleteFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { key } = req.body as { key?: string };

      if (!key || typeof key !== "string") throw new ValidationError("key_required");

      if (key.includes("..") || key.startsWith("/")) {
        throw new ValidationError("invalid_key");
      }

      await this.mediaService.deleteFile(key);
      res.json(ApiResponse.success(null, "media_deleted"));
    } catch (error) {
      next(error);
    }
  };

  deleteFolder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { folder, entityId } = req.body as {
        folder?: string;
        entityId?: string;
      };

      if (!folder || !(ALLOWED_FOLDERS as readonly string[]).includes(folder)) {
        throw new ValidationError("invalid_folder");
      }

      if (!entityId || !UUID_REGEX.test(entityId)) {
        throw new ValidationError("entity_id_must_be_a_valid_uuid");
      }

      await this.mediaService.deleteEntityMedia(folder as MediaFolder, entityId);
      res.json(ApiResponse.success(null, "media_folder_deleted"));
    } catch (error) {
      next(error);
    }
  };
}
