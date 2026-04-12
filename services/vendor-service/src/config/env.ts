import { ConfigLoader, ServiceAuthenticator } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  authServiceUrl: string;
  vendorServiceClientId: string;
  vendorServiceClientSecret: string;
  authServiceTokenUrl: string;
}>({
  port: { env: "PORT", default: 3003 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "vendor_db" },
  authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
  vendorServiceClientId: { env: "VENDOR_SERVICE_CLIENT_ID", default: "vendor-service-id" },
  vendorServiceClientSecret: { env: "VENDOR_SERVICE_CLIENT_SECRET", required: true, sensitive: true },
  authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
});

export const vendorServiceAuthenticator = new ServiceAuthenticator(
  config.vendorServiceClientId,
  config.vendorServiceClientSecret,
  config.authServiceTokenUrl,
  "VendorService"
);
