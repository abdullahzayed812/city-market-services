import { randomUUID } from "crypto";
import sharp from "sharp";
import { AppError, ValidationError } from "@city-market/shared";
import { IPrivateStorageService, PrivateObjectInfo } from "../../core/interfaces/storage.interface";
import { MediaFolder, MediaUploadResult } from "../../core/entities/media.entity";
import { MediaService } from "./media.service";
import { SubmissionImageRules, mimeTypesFor, validateAndNormalizeSubmissionImage } from "./submission-image.validator";

export const SUBMISSION_IMAGE_PREFIX = "product-submissions/";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// product-submissions/<uploader user id>/<random id>.webp — the owner is part of the key, so
// catalog-service can check a merchant only attaches their own uploads.
export const SUBMISSION_KEY_REGEX = new RegExp(`^product-submissions/(${UUID})/${UUID}\\.webp$`, "i");

export interface SubmissionImageUpload {
  key: string;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
}

export function assertSubmissionKey(key: unknown): string {
  if (typeof key !== "string" || !SUBMISSION_KEY_REGEX.test(key)) throw new ValidationError("invalid_key");
  return key;
}

export class SubmissionImageService {
  constructor(
    private readonly storage: IPrivateStorageService,
    private readonly mediaService: MediaService,
    private readonly rules: SubmissionImageRules,
    private readonly signedUrlTtlSeconds: number,
  ) {}

  getRules() {
    return {
      formats: this.rules.formats,
      mimeTypes: mimeTypesFor(this.rules.formats),
      minWidth: this.rules.minWidth,
      minHeight: this.rules.minHeight,
      maxBytes: this.rules.maxBytes,
    };
  }

  async upload(buffer: Buffer, declaredMime: string | undefined, uploaderUserId: string): Promise<SubmissionImageUpload> {
    if (!this.storage.isConfigured()) throw new AppError(503, "private_storage_not_configured");
    const image = await validateAndNormalizeSubmissionImage(buffer, declaredMime, this.rules);
    const key = `${SUBMISSION_IMAGE_PREFIX}${uploaderUserId}/${randomUUID()}.webp`;
    await this.storage.upload(image.buffer, key, image.contentType, { width: String(image.width), height: String(image.height) });
    return {
      key,
      width: image.width,
      height: image.height,
      bytes: image.buffer.length,
      previewUrl: await this.storage.signedUrl(key, this.signedUrlTtlSeconds),
    };
  }

  async stat(key: string): Promise<PrivateObjectInfo | null> {
    return this.storage.stat(assertSubmissionKey(key));
  }

  async signedUrls(keys: unknown[]): Promise<{ urls: Record<string, string>; expiresAt: string }> {
    const valid = keys.map(assertSubmissionKey);
    const urls: Record<string, string> = {};
    // Presigning is local (no request to R2)
    for (const key of valid) urls[key] = await this.storage.signedUrl(key, this.signedUrlTtlSeconds);
    return { urls, expiresAt: new Date(Date.now() + this.signedUrlTtlSeconds * 1000).toISOString() };
  }

  // Copies an approved proposal photo to the public catalog, through the same pipeline and
  // path convention as every other catalog image (<folder>/<entityId>/large.webp). Writing the
  // same destination again is harmless, so a retried approval can call this again.
  async promote(key: string, folder: MediaFolder, entityId: string): Promise<MediaUploadResult> {
    const buffer = await this.storage.get(assertSubmissionKey(key));
    if (!buffer) throw new AppError(404, "submission_image_missing");
    // The stored copy was validated at upload; check it is still a sound image of the minimum size
    let meta: sharp.Metadata;
    try {
      meta = await sharp(buffer, { failOn: "truncated" }).metadata();
    } catch {
      throw new ValidationError("image_corrupted");
    }
    if (!meta.width || !meta.height) throw new ValidationError("image_corrupted");
    if (meta.width < this.rules.minWidth || meta.height < this.rules.minHeight) throw new ValidationError("image_too_small");
    return this.mediaService.uploadImage(buffer, folder, entityId);
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(assertSubmissionKey(key));
  }

  // Objects under the proposal prefix older than olderThanSeconds (for orphan cleanup)
  async listOlderThan(olderThanSeconds: number, limit: number): Promise<PrivateObjectInfo[]> {
    const cutoff = Date.now() - olderThanSeconds * 1000;
    const all = await this.storage.list(SUBMISSION_IMAGE_PREFIX, limit);
    return all.filter((o) => o.lastModified && o.lastModified.getTime() < cutoff);
  }
}
