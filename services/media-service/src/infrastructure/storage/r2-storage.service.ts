import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { IStorageService, UploadResult } from "../../core/interfaces/storage.interface.js";
import { Logger } from "@city-market/shared/node";

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  cdnUrl: string;
}

export class R2StorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string;

  constructor(config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
    this.cdnUrl = config.cdnUrl.replace(/\/$/, "");
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    Logger.info(`[R2] Uploaded: ${key}`);
    return { key, url: this.getPublicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    Logger.info(`[R2] Deleted: ${key}`);
  }

  async deleteFolder(prefix: string): Promise<void> {
    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

    const listResult = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: normalizedPrefix }),
    );

    if (!listResult.Contents?.length) return;

    await Promise.all(
      listResult.Contents.filter((obj) => !!obj.Key).map((obj) => this.delete(obj.Key!)),
    );

    Logger.info(
      `[R2] Deleted folder: ${normalizedPrefix} (${listResult.Contents.length} objects)`,
    );
  }

  getPublicUrl(key: string): string {
    return `${this.cdnUrl}/${key}`;
  }
}
