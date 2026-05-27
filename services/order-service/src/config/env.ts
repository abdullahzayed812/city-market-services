import { ConfigLoader, ServiceAuthenticator } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  catalogServiceUrl: string;
  vendorServiceUrl: string;
  userServiceUrl: string;
  authServiceUrl: string;
  orderServiceClientId: string;
  orderServiceClientSecret: string;
  authServiceTokenUrl: string;
  rabbitMqUrl: string;
  redisUrl: string;
  vendorConfirmationSlaMins: number;
  customerDecisionSlaMins: number;
}>({
  port: { env: "PORT", default: 3005 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "order_db" },
  catalogServiceUrl: { env: "CATALOG_SERVICE_URL", default: "http://localhost:3004" },
  vendorServiceUrl: { env: "VENDOR_SERVICE_URL", default: "http://localhost:3003" },
  userServiceUrl: { env: "USER_SERVICE_URL", default: "http://localhost:3002" },
  authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
  orderServiceClientId: { env: "ORDER_SERVICE_CLIENT_ID", default: "order-service-id" },
  orderServiceClientSecret: { env: "ORDER_SERVICE_CLIENT_SECRET", required: true, sensitive: true },
  authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
  rabbitMqUrl: { env: "RABBITMQ_URL", default: "amqp://localhost" },
  redisUrl: { env: "REDIS_URL", default: "redis://localhost:6379" },
  vendorConfirmationSlaMins: { env: "VENDOR_CONFIRMATION_SLA_MINUTES", default: 10 },
  customerDecisionSlaMins: { env: "CUSTOMER_DECISION_SLA_MINUTES", default: 15 },
});

export const orderServiceAuthenticator = new ServiceAuthenticator(
  config.orderServiceClientId,
  config.orderServiceClientSecret,
  config.authServiceTokenUrl,
  "OrderService"
);
