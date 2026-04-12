import { ConfigLoader, ServiceAuthenticator } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
    port: number;
    dbHost: string;
    dbPort: number;
    dbUser: string;
    dbPassword: string;
    dbName: string;
    orderServiceUrl: string;
    userServiceUrl: string;
    vendorServiceUrl: string;
    authServiceUrl: string;
    ratingServiceClientId: string;
    ratingServiceClientSecret: string;
    authServiceTokenUrl: string;
    rabbitMQUrl: string;
}>({
    port: { env: "PORT", default: 3010 },
    dbHost: { env: "DB_HOST", default: "localhost" },
    dbPort: { env: "DB_PORT", default: 3306 },
    dbUser: { env: "DB_USER", required: true },
    dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
    dbName: { env: "DB_NAME", default: "rating_db" },
    orderServiceUrl: { env: "ORDER_SERVICE_URL", default: "http://localhost:3005" },
    userServiceUrl: { env: "USER_SERVICE_URL", default: "http://localhost:3002" },
    vendorServiceUrl: { env: "VENDOR_SERVICE_URL", default: "http://localhost:3003" },
    authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
    ratingServiceClientId: { env: "RATING_SERVICE_CLIENT_ID", default: "rating-service-id" },
    ratingServiceClientSecret: { env: "RATING_SERVICE_CLIENT_SECRET", required: true, sensitive: true },
    authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
    rabbitMQUrl: { env: "RABBITMQ_URL", default: "amqp://localhost" },
});

export const ratingServiceAuthenticator = new ServiceAuthenticator(
    config.ratingServiceClientId,
    config.ratingServiceClientSecret,
    config.authServiceTokenUrl,
    "RatingService"
);
