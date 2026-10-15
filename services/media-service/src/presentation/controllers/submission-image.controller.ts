import { Response, NextFunction } from "express";
import { ApiResponse, ForbiddenError, ValidationError } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { SubmissionImageService } from "../../application/services/submission-image.service";
import { ALLOWED_FOLDERS, MediaFolder } from "../../core/entities/media.entity";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The private-object operations are for catalog-service only (service token): merchants
// never read, list, publish or delete proposal photos directly.
const assertService = (req: AuthenticatedRequest) => {
  if (req.authType !== "service" || !req.service) throw new ForbiddenError("insufficient_permissions");
};

export class SubmissionImageController {
  constructor(private readonly service: SubmissionImageService) {}

  rules = (_req: AuthenticatedRequest, res: Response) => {
    res.json(ApiResponse.success(this.service.getRules()));
  };

  upload = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // The uploader's user id becomes part of the key (ownership), so a user token is required
      if (!req.user) throw new ForbiddenError("insufficient_permissions");
      if (!req.file) throw new ValidationError("no_file_provided");
      const result = await this.service.upload(req.file.buffer, req.file.mimetype, req.user.userId);
      res.status(201).json(ApiResponse.success(result, "media_uploaded"));
    } catch (error) {
      next(error);
    }
  };

  stat = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertService(req);
      const info = await this.service.stat(req.body?.key);
      const width = Number(info?.metadata?.width) || null;
      const height = Number(info?.metadata?.height) || null;
      res.json(ApiResponse.success(info ? { exists: true, bytes: info.bytes, lastModified: info.lastModified, width, height } : { exists: false }));
    } catch (error) {
      next(error);
    }
  };

  // body: { keys: string[] } (max 100) -> { urls: { [key]: url }, expiresAt }
  signedUrls = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertService(req);
      const keys = req.body?.keys;
      if (!Array.isArray(keys) || keys.length === 0 || keys.length > 100) throw new ValidationError("keys_required");
      res.json(ApiResponse.success(await this.service.signedUrls(keys)));
    } catch (error) {
      next(error);
    }
  };

  promote = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertService(req);
      const { key, folder, entityId } = req.body ?? {};
      if (!folder || !(ALLOWED_FOLDERS as readonly string[]).includes(folder)) throw new ValidationError("invalid_folder");
      if (!entityId || !UUID_REGEX.test(entityId)) throw new ValidationError("entity_id_must_be_a_valid_uuid");
      const result = await this.service.promote(key, folder as MediaFolder, entityId);
      res.status(201).json(ApiResponse.success(result, "media_uploaded"));
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertService(req);
      await this.service.delete(req.body?.key);
      res.json(ApiResponse.success(null, "media_deleted"));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertService(req);
      const olderThanSeconds = Math.max(0, Number(req.body?.olderThanSeconds) || 0);
      const limit = Math.min(5000, Math.max(1, Number(req.body?.limit) || 1000));
      const items = await this.service.listOlderThan(olderThanSeconds, limit);
      res.json(ApiResponse.success({ keys: items.map((i) => i.key) }));
    } catch (error) {
      next(error);
    }
  };
}
