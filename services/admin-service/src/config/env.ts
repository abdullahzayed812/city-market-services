import { ConfigLoader, ServiceAuthenticator } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  orderServiceUrl: string;
  vendorServiceUrl: string;
  deliveryServiceUrl: string;
  userServiceUrl: string;
  authServiceUrl: string;
  catalogServiceUrl: string;
  adminServiceClientId: string;
  adminServiceClientSecret: string;
  authServiceTokenUrl: string;
}>({
  port: { env: "PORT", default: 3007 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "admin_db" },
  orderServiceUrl: { env: "ORDER_SERVICE_URL", default: "http://localhost:3005" },
  vendorServiceUrl: { env: "VENDOR_SERVICE_URL", default: "http://localhost:3003" },
  deliveryServiceUrl: { env: "DELIVERY_SERVICE_URL", default: "http://localhost:3006" },
  userServiceUrl: { env: "USER_SERVICE_URL", default: "http://localhost:3002" },
  authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
  catalogServiceUrl: { env: "CATALOG_SERVICE_URL", default: "http://localhost:3004" },
  adminServiceClientId: { env: "ADMIN_SERVICE_CLIENT_ID", default: "admin-service-id" },
  adminServiceClientSecret: { env: "ADMIN_SERVICE_CLIENT_SECRET", required: true, sensitive: true },
  authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
});

export const adminServiceAuthenticator = new ServiceAuthenticator(
  config.adminServiceClientId,
  config.adminServiceClientSecret,
  config.authServiceTokenUrl,
  "AdminService"
);
