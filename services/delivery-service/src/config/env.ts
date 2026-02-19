import { Logger, ServiceAuthenticator } from "@city-market/shared/node";

export const config = {
  port: process.env.PORT || 3006,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: parseInt(process.env.DB_PORT || "3306"),
  dbUser: process.env.DB_USER || "abdo",
  dbPassword: process.env.DB_PASSWORD || "password",
  dbName: process.env.DB_NAME || "delivery_db",
  orderServiceUrl: process.env.ORDER_SERVICE_URL || "http://localhost:3005",
  vendorServiceUrl: process.env.VENDOR_SERVICE_URL || "http://localhost:3003",
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001", // Added auth service URL
  deliveryServiceClientId: process.env.DELIVERY_SERVICE_CLIENT_ID || "delivery-service-id",
  deliveryServiceClientSecret: process.env.DELIVERY_SERVICE_CLIENT_SECRET || "delivery-service-secret",
  authServiceTokenUrl:
    process.env.AUTH_SERVICE_TOKEN_URL || `${process.env.AUTH_SERVICE_URL || "http://localhost:3001"}/oauth/token`,
};

export const deliveryServiceAuthenticator = new ServiceAuthenticator(
  config.deliveryServiceClientId,
  config.deliveryServiceClientSecret,
  config.authServiceTokenUrl,
  "DeliveryService"
);
