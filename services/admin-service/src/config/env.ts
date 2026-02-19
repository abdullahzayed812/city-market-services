import { Logger, ServiceAuthenticator } from "@city-market/shared/node";

export const config = {
  port: process.env.PORT || 3007,
  orderServiceUrl: process.env.ORDER_SERVICE_URL || "http://localhost:3005",
  vendorServiceUrl: process.env.VENDOR_SERVICE_URL || "http://localhost:3003",
  deliveryServiceUrl: process.env.DELIVERY_SERVICE_URL || "http://localhost:3006",
  userServiceUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  adminServiceClientId: process.env.ADMIN_SERVICE_CLIENT_ID || "admin-service-id",
  adminServiceClientSecret: process.env.ADMIN_SERVICE_CLIENT_SECRET || "admin-service-secret",
  authServiceTokenUrl:
    process.env.AUTH_SERVICE_TOKEN_URL || `${process.env.AUTH_SERVICE_URL || "http://localhost:3001"}/oauth/token`,
};

export const adminServiceAuthenticator = new ServiceAuthenticator(
  config.adminServiceClientId,
  config.adminServiceClientSecret,
  config.authServiceTokenUrl,
  "AdminService"
);
