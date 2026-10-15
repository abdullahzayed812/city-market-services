import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { IPrivateStorageService, PrivateObjectInfo } from "../../core/interfaces/storage.interface";

export interface R2PrivateConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  // Empty: not configured, every call fails with 503
  bucket: string;
  // Path-style URLs (S3-compatible test servers); R2 works either way
  forcePathStyle?: boolean;
}

// Objects in a bucket without public access. Signed URLs are credentials: never log them.
export class R2PrivateStorageService implements IPrivateStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: R2PrivateConfig) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: config.forcePathStyle,
    });
    this.bucket = config.bucket;
  }

  isConfigured(): boolean {
    return !!this.bucket;
  }

  private assertConfigured(): void {
    if (!this.bucket) throw new AppError(503, "private_storage_not_configured");
  }

  async upload(buffer: Buffer, key: string, contentType: string, metadata?: Record<string, string>): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "private, no-store",
        Metadata: metadata,
      }),
    );
    Logger.info(`[R2 private] Uploaded: ${key}`);
  }

  async get(key: string): Promise<Buffer | null> {
    this.assertConfigured();
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error: any) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async stat(key: string): Promise<PrivateObjectInfo | null> {
    this.assertConfigured();
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { key, bytes: head.ContentLength ?? 0, lastModified: head.LastModified ?? null, metadata: head.Metadata };
    } catch (error: any) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    Logger.info(`[R2 private] Deleted: ${key}`);
  }

  async list(prefix: string, limit: number): Promise<PrivateObjectInfo[]> {
    this.assertConfigured();
    const items: PrivateObjectInfo[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }),
      );
      for (const obj of page.Contents ?? []) {
        if (obj.Key) items.push({ key: obj.Key, bytes: obj.Size ?? 0, lastModified: obj.LastModified ?? null });
        if (items.length >= limit) return items;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return items;
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    this.assertConfigured();
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttlSeconds });
  }
}

function isNotFound(error: any): boolean {
  return error?.name === "NotFound" || error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404;
}
