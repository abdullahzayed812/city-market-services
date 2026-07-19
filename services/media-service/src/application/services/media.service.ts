import { IStorageService } from "../../core/interfaces/storage.interface.js";
import { MediaFolder, MediaUploadResult } from "../../core/entities/media.entity.js";
import { ImageOptimizerService } from "./image-optimizer.service.js";
import { fetchImageFromUrl } from "../../infrastructure/net/safe-url-fetcher.js";

export class MediaService {
  constructor(
    private readonly storage: IStorageService,
    private readonly optimizer: ImageOptimizerService,
  ) { }

  async uploadImage(
    buffer: Buffer,
    folder: MediaFolder,
    entityId: string,
  ): Promise<MediaUploadResult> {
    return this.processAndStore(buffer, folder, entityId);
  }

  async uploadImageFromUrl(
    imageUrl: string,
    folder: MediaFolder,
    entityId: string,
  ): Promise<MediaUploadResult> {
    const { buffer } = await fetchImageFromUrl(imageUrl);
    return this.processAndStore(buffer, folder, entityId);
  }

  private async processAndStore(
    buffer: Buffer,
    folder: MediaFolder,
    entityId: string,
  ): Promise<MediaUploadResult> {
    const processed = await this.optimizer.processAll(buffer);
    const basePath = `${folder}/${entityId}`;

    // const [small, medium, large] = await Promise.all([
    //   this.storage.upload(processed.small, `${basePath}/small.webp`, "image/webp"),
    //   this.storage.upload(processed.medium, `${basePath}/medium.webp`, "image/webp"),
    //   this.storage.upload(processed.large, `${basePath}/large.webp`, "image/webp"),
    // ]);
    const large = await this.storage.upload(processed.large, `${basePath}/large.webp`, "image/webp");

    return {
      url: large.url,
      sizes: {
        // small: small.url,
        // medium: medium.url,
        small: large.url,
        medium: large.url,
        large: large.url,
      },
    };
  }

  async deleteFile(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  async deleteEntityMedia(folder: MediaFolder, entityId: string): Promise<void> {
    await this.storage.deleteFolder(`${folder}/${entityId}`);
  }
}
