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
  redisUrl: string;
  deliveryAcceptanceSlaMins: number;
  courierAssignmentSlaMins: number;
  courierPickupSlaMins: number;
  freelanceEnabled: boolean;
  officePriorityWindowMins: number;
  freelanceRadiusKm: number;
  freelanceMaxCashHeld: number;
  courierLocationStaleMins: number;
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
  authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
  deliveryServiceClientId: { env: "DELIVERY_SERVICE_CLIENT_ID", default: "delivery-service-id" },
  deliveryServiceClientSecret: { env: "DELIVERY_SERVICE_CLIENT_SECRET", required: true, sensitive: true },
  authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
  redisUrl: { env: "REDIS_URL", default: "redis://localhost:6379" },
  deliveryAcceptanceSlaMins: { env: "DELIVERY_ACCEPTANCE_SLA_MINUTES", default: 5 },
  courierAssignmentSlaMins: { env: "COURIER_ASSIGNMENT_SLA_MINUTES", default: 5 },
  courierPickupSlaMins: { env: "COURIER_PICKUP_SLA_MINUTES", default: 30 },
  // Freelance dispatch (docs/freelance-couriers-audit.md §3.3)
  freelanceEnabled: { env: "FREELANCE_ENABLED", default: false },
  // Offices get this long to accept before freelancers see the delivery. 0 = everyone at once.
  officePriorityWindowMins: { env: "OFFICE_PRIORITY_WINDOW_MINS", default: 2 },
  // 0 disables the radius filter
  freelanceRadiusKm: { env: "FREELANCE_RADIUS_KM", default: 5 },
  // A freelancer holding more uncollected cash than this can't claim until settled. 0 = no cap.
  freelanceMaxCashHeld: { env: "FREELANCE_MAX_CASH_HELD", default: 2000 },
  // Freelancers whose last location heartbeat is older than this aren't notified of new jobs
  courierLocationStaleMins: { env: "COURIER_LOCATION_STALE_MINUTES", default: 10 },
});

export const deliveryServiceAuthenticator = new ServiceAuthenticator(
  config.deliveryServiceClientId,
  config.deliveryServiceClientSecret,
  config.authServiceTokenUrl,
  "DeliveryService",
);
