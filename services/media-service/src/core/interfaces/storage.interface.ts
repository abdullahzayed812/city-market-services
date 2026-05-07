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
