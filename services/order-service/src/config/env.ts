import { Logger, ServiceAuthenticator } from "@city-market/shared/node";

export const config = {
  port: process.env.PORT || 3005,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: parseInt(process.env.DB_PORT || "3306"),
  dbUser: process.env.DB_USER || "abdo",
  dbPassword: process.env.DB_PASSWORD || "password",
  dbName: process.env.DB_NAME || "order_db",
  catalogServiceUrl: process.env.CATALOG_SERVICE_URL || "http://localhost:3004",
  vendorServiceUrl: process.env.VENDOR_SERVICE_URL || "http://localhost:3003",
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  orderServiceClientId: process.env.ORDER_SERVICE_CLIENT_ID || "order-service-id",
  orderServiceClientSecret: process.env.ORDER_SERVICE_CLIENT_SECRET || "order-service-secret",
  authServiceTokenUrl:
    process.env.AUTH_SERVICE_TOKEN_URL || `${process.env.AUTH_SERVICE_URL || "http://localhost:3001"}/oauth/token`,
};

export const orderServiceAuthenticator = new ServiceAuthenticator(
  config.orderServiceClientId,
  config.orderServiceClientSecret,
  config.authServiceTokenUrl,
  "OrderService"
);
