export interface SubmissionImageInfo {
  exists: boolean;
  width?: number | null;
  height?: number | null;
}

// media-service operations on product-proposal photos (private storage)
export interface ISubmissionMedia {
  stat(key: string): Promise<SubmissionImageInfo>;
  // Short-lived signed URLs; empty for keys that couldn't be signed. Never log them.
  signedUrls(keys: string[]): Promise<Record<string, string>>;
  // Copies the photo to the public catalog at globals/<globalProductId>/large.webp
  promote(key: string, globalProductId: string): Promise<{ url: string }>;
  deletePrivate(key: string): Promise<void>;
  // Public catalog folder of a global product id that was reserved but never used
  deletePublicFolder(globalProductId: string): Promise<void>;
  listPrivateOlderThan(olderThanSeconds: number, limit: number): Promise<string[]>;
}
