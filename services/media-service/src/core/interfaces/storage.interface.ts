export interface UploadResult {
  key: string;
  url: string;
}

export interface IStorageService {
  upload(buffer: Buffer, key: string, contentType: string): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  deleteFolder(prefix: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export interface PrivateObjectInfo {
  key: string;
  bytes: number;
  lastModified: Date | null;
  metadata?: Record<string, string>;
}

// Unpublished objects (product-proposal photos). Never served from the CDN; read through
// short-lived signed URLs or by the service itself.
export interface IPrivateStorageService {
  isConfigured(): boolean;
  upload(buffer: Buffer, key: string, contentType: string, metadata?: Record<string, string>): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  stat(key: string): Promise<PrivateObjectInfo | null>;
  delete(key: string): Promise<void>;
  list(prefix: string, limit: number): Promise<PrivateObjectInfo[]>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}
