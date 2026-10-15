import { ConfigLoader } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PrivateBucket: string;
  allowPublicBucketForSubmissions: boolean;
  cdnUrl: string;
  jwtSecret: string;
  submissionImageFormats: string;
  submissionImageMinWidth: number;
  submissionImageMinHeight: number;
  submissionImageMaxBytes: number;
  submissionImageMaxPixels: number;
  submissionImageOutputMaxSide: number;
  submissionUploadLimit: number;
  submissionUploadWindowMs: number;
  privateSignedUrlTtlSeconds: number;
}>({
  port: { env: "PORT", default: 3012 },
  r2Endpoint: { env: "R2_ENDPOINT", required: true },
  r2AccessKeyId: { env: "R2_ACCESS_KEY_ID", required: true, sensitive: true },
  r2SecretAccessKey: { env: "R2_SECRET_ACCESS_KEY", required: true, sensitive: true },
  r2Bucket: { env: "R2_BUCKET", required: true },
  // A bucket with public access OFF. Holds merchants' product-proposal photos until an admin
  // approves them; they are only read through short-lived signed URLs.
  r2PrivateBucket: { env: "R2_PRIVATE_BUCKET", default: "" },
  // Development only: keep proposal photos in the public bucket (random, unlisted keys)
  // when no private bucket exists. Never enable this in production.
  allowPublicBucketForSubmissions: { env: "SUBMISSION_ALLOW_PUBLIC_BUCKET", default: false },
  cdnUrl: { env: "CDN_URL", default: "https://pub-7511c1b2d5e34cdb8067140032d3eec0.r2.dev" },
  jwtSecret: { env: "JWT_ACCESS_SECRET", required: true, sensitive: true },
  // Product-proposal photo rules (checked on the decoded content, not the file name / MIME)
  submissionImageFormats: { env: "SUBMISSION_IMAGE_FORMATS", default: "jpeg,png,webp" },
  submissionImageMinWidth: { env: "SUBMISSION_IMAGE_MIN_WIDTH", default: 800 },
  submissionImageMinHeight: { env: "SUBMISSION_IMAGE_MIN_HEIGHT", default: 800 },
  submissionImageMaxBytes: { env: "SUBMISSION_IMAGE_MAX_BYTES", default: 5 * 1024 * 1024 },
  // Decompression-bomb guard
  submissionImageMaxPixels: { env: "SUBMISSION_IMAGE_MAX_PIXELS", default: 40_000_000 },
  // Stored proposal photos are re-encoded to fit inside this square (aspect ratio kept)
  submissionImageOutputMaxSide: { env: "SUBMISSION_IMAGE_OUTPUT_MAX_SIDE", default: 1600 },
  submissionUploadLimit: { env: "SUBMISSION_UPLOAD_LIMIT", default: 20 },
  submissionUploadWindowMs: { env: "SUBMISSION_UPLOAD_WINDOW_MS", default: 10 * 60 * 1000 },
  privateSignedUrlTtlSeconds: { env: "PRIVATE_SIGNED_URL_TTL_SECONDS", default: 600 },
});
