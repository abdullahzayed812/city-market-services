import { Response, NextFunction } from "express";
import { MediaService } from "../../application/services/media.service";
import { randomUUID } from "crypto";
import { ApiResponse, ValidationError, ForbiddenError, UserRole } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { MediaFolder, ALLOWED_FOLDERS, COURIER_DOCUMENTS_FOLDER, OFFICE_DOCUMENTS_FOLDER } from "../../core/entities/media.entity";

// Roles that may only upload signup documents, and to which folders. Managers upload
// their office's documents and the documents of couriers they add to their office.
const DOCUMENT_FOLDERS_BY_ROLE: Partial<Record<UserRole, MediaFolder[]>> = {
  [UserRole.COURIER]: [COURIER_DOCUMENTS_FOLDER],
  [UserRole.DELIVERY_MANAGER]: [OFFICE_DOCUMENTS_FOLDER, COURIER_DOCUMENTS_FOLDER],
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  upload = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new ValidationError("no_file_provided");

      let { folder, entityId } = req.body as { folder: string; entityId: string };

      const documentFolders = req.user ? DOCUMENT_FOLDERS_BY_ROLE[req.user.role] : undefined;
      if (documentFolders) {
        if (!documentFolders.includes(folder as MediaFolder)) throw new ForbiddenError("can_only_upload_signup_documents");
        // The bucket is public: a server-chosen random id keeps the path unguessable and
        // stops a courier from overwriting someone else's document by reusing an id.
        entityId = randomUUID();
      }

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
