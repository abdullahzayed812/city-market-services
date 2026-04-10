import { Logger, ServiceAuthenticator } from "@city-market/shared/node";

export const config = {
  port: process.env.PORT || 3003,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: parseInt(process.env.DB_PORT || "3306"),
  dbUser: process.env.DB_USER || "abdo",
  dbPassword: process.env.DB_PASSWORD || "password",
  dbName: process.env.DB_NAME || "vendor_db",
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  vendorServiceClientId: process.env.VENDOR_SERVICE_CLIENT_ID || "vendor-service-id",
  vendorServiceClientSecret: process.env.VENDOR_SERVICE_CLIENT_SECRET || "vendor-service-secret",
  authServiceTokenUrl:
    process.env.AUTH_SERVICE_TOKEN_URL || `${process.env.AUTH_SERVICE_URL || "http://localhost:3001"}/oauth/token`,
};

export const vendorServiceAuthenticator = new ServiceAuthenticator(
  config.vendorServiceClientId,
  config.vendorServiceClientSecret,
  config.authServiceTokenUrl,
  "VendorService"
);
