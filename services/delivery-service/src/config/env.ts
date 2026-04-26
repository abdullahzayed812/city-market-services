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
  userServiceUrl: string;
  authServiceUrl: string;
  deliveryServiceClientId: string;
  deliveryServiceClientSecret: string;
  authServiceTokenUrl: string;
  assignedWindowMinutes: number;
}>({
  port: { env: "PORT", default: 3006 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "delivery_db" },
  orderServiceUrl: { env: "ORDER_SERVICE_URL", default: "http://localhost:3005" },
  vendorServiceUrl: { env: "VENDOR_SERVICE_URL", default: "http://localhost:3003" },
  userServiceUrl: { env: "USER_SERVICE_URL", default: "http://localhost:3002" },
  assignedWindowMinutes: { env: "ASSIGNED_WINDOW_MINUTES", default: 15 },
  authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
  deliveryServiceClientId: { env: "DELIVERY_SERVICE_CLIENT_ID", default: "delivery-service-id" },
  deliveryServiceClientSecret: { env: "DELIVERY_SERVICE_CLIENT_SECRET", required: true, sensitive: true },
  authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
});

export const deliveryServiceAuthenticator = new ServiceAuthenticator(
  config.deliveryServiceClientId,
  config.deliveryServiceClientSecret,
  config.authServiceTokenUrl,
  "DeliveryService"
);
