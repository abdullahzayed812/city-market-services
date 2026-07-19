import { ConfigLoader, ServiceAuthenticator } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  rabbitMqUrl: string;
  mediaServiceUrl: string;
  authServiceTokenUrl: string;
  catalogServiceClientId: string;
  catalogServiceClientSecret: string;
}>({
  port: { env: "PORT", default: 3004 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "catalog_db" },
  rabbitMqUrl: { env: "RABBITMQ_URL", default: "amqp://localhost" },
  mediaServiceUrl: { env: "MEDIA_SERVICE_URL", default: "http://localhost:3012" },
  authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
  catalogServiceClientId: { env: "CATALOG_SERVICE_CLIENT_ID", default: "catalog-service-id" },
  catalogServiceClientSecret: { env: "CATALOG_SERVICE_CLIENT_SECRET", required: true, sensitive: true },
});

export const catalogServiceAuthenticator = new ServiceAuthenticator(
  config.catalogServiceClientId,
  config.catalogServiceClientSecret,
  config.authServiceTokenUrl,
  "CatalogService",
);
