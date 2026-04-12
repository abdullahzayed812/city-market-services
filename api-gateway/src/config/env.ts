import { ConfigLoader } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  authServiceUrl: string;
  userServiceUrl: string;
  vendorServiceUrl: string;
  catalogServiceUrl: string;
  orderServiceUrl: string;
  deliveryServiceUrl: string;
  adminServiceUrl: string;
  notificationsServiceUrl: string;
  ratingServiceUrl: string;
  jwtSecret: string;
}>({
  port: { env: "PORT", default: 3000 },
  authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001", required: true },
  userServiceUrl: { env: "USER_SERVICE_URL", default: "http://localhost:3002" },
  vendorServiceUrl: { env: "VENDOR_SERVICE_URL", default: "http://localhost:3003" },
  catalogServiceUrl: { env: "CATALOG_SERVICE_URL", default: "http://localhost:3004" },
  orderServiceUrl: { env: "ORDER_SERVICE_URL", default: "http://localhost:3005" },
  deliveryServiceUrl: { env: "DELIVERY_SERVICE_URL", default: "http://localhost:3006" },
  adminServiceUrl: { env: "ADMIN_SERVICE_URL", default: "http://localhost:3007" },
  notificationsServiceUrl: { env: "NOTIFICATIONS_SERVICE_URL", default: "http://localhost:3008" },
  ratingServiceUrl: { env: "RATING_SERVICE_URL", default: "http://localhost:3010" },
  jwtSecret: { env: "JWT_SECRET", default: "access_secret_key", sensitive: true },
});
