import { ConfigLoader } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  cdnUrl: string;
  jwtSecret: string;
}>({
  port: { env: "PORT", default: 3012 },
  r2Endpoint: { env: "R2_ENDPOINT", required: true },
  r2AccessKeyId: { env: "R2_ACCESS_KEY_ID", required: true, sensitive: true },
  r2SecretAccessKey: { env: "R2_SECRET_ACCESS_KEY", required: true, sensitive: true },
  r2Bucket: { env: "R2_BUCKET", required: true },
  cdnUrl: { env: "CDN_URL", default: "https://cdn.citymarket.app" },
  jwtSecret: { env: "JWT_ACCESS_SECRET", required: true, sensitive: true },
});
