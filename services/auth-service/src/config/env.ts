import { ConfigLoader } from "@city-market/shared/node";

const loadedConfig = ConfigLoader.load<{
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtServiceAccessSecret: string;
  jwtAccessExpiry: string;
  jwtRefreshExpiry: string;
  jwtServiceAccessExpiry: string;
}>({
  port: { env: "PORT", default: 3001 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "auth_db" },
  jwtAccessSecret: { env: "JWT_ACCESS_SECRET", required: true, sensitive: true },
  jwtRefreshSecret: { env: "JWT_REFRESH_SECRET", required: true, sensitive: true },
  jwtServiceAccessSecret: { env: "JWT_SERVICE_ACCESS_SECRET", required: true, sensitive: true },
  jwtAccessExpiry: { env: "JWT_ACCESS_EXPIRY", default: "15m" },
  jwtRefreshExpiry: { env: "JWT_REFRESH_EXPIRY", default: "7d" },
  jwtServiceAccessExpiry: { env: "JWT_SERVICE_ACCESS_EXPIRY", default: "15m" },
});

export const config = {
  ...loadedConfig,
  registeredServiceClients: [
    {
      clientId: process.env.ADMIN_SERVICE_CLIENT_ID || "admin-service-id",
      clientSecret: process.env.ADMIN_SERVICE_CLIENT_SECRET || "admin-service-secret",
      scope: "admin",
    },
    {
      clientId: process.env.ORDER_SERVICE_CLIENT_ID || "order-service-id",
      clientSecret: process.env.ORDER_SERVICE_CLIENT_SECRET || "order-service-secret",
      scope: "order",
    },
    {
      clientId: process.env.DELIVERY_SERVICE_CLIENT_ID || "delivery-service-id",
      clientSecret: process.env.DELIVERY_SERVICE_CLIENT_SECRET || "delivery-service-secret",
      scope: "delivery",
    },
    {
      clientId: process.env.WEBSOCKET_GATEWAY_CLIENT_ID || "websocket-gateway-id",
      clientSecret: process.env.WEBSOCKET_GATEWAY_CLIENT_SECRET || "websocket-gateway-secret",
      scope: "websocket",
    },
    {
      clientId: process.env.RATING_SERVICE_CLIENT_ID || "rating-service-id",
      clientSecret: process.env.RATING_SERVICE_CLIENT_SECRET || "rating-service-secret",
      scope: "rating",
    },
    {
      clientId: process.env.PAYMENT_SERVICE_CLIENT_ID || "payment-service-id",
      clientSecret: process.env.PAYMENT_SERVICE_CLIENT_SECRET || "payment-service-secret",
      scope: "payment",
    },
    {
      clientId: process.env.CATALOG_SERVICE_CLIENT_ID || "catalog-service-id",
      clientSecret: process.env.CATALOG_SERVICE_CLIENT_SECRET || "catalog-service-secret",
      scope: "catalog",
    },
    {
      clientId: process.env.NOTIFICATION_SERVICE_CLIENT_ID || "notification-service-id",
      clientSecret: process.env.NOTIFICATION_SERVICE_CLIENT_SECRET || "notification-service-secret",
      scope: "notification",
    },
    {
      clientId: process.env.VENDOR_SERVICE_CLIENT_ID || "vendor-service-id",
      clientSecret: process.env.VENDOR_SERVICE_CLIENT_SECRET || "vendor-service-secret",
      scope: "vendor",
    },
  ],
};
