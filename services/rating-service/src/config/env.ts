import { ServiceAuthenticator } from "@city-market/shared/node";

export const config = {
    port: process.env.PORT || 3010,
    dbHost: process.env.DB_HOST || "localhost",
    dbPort: parseInt(process.env.DB_PORT || "3306"),
    dbUser: process.env.DB_USER || "abdo",
    dbPassword: process.env.DB_PASSWORD || "password",
    dbName: process.env.DB_NAME || "rating_db",
    orderServiceUrl: process.env.ORDER_SERVICE_URL || "http://localhost:3005",
    userServiceUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
    vendorServiceUrl: process.env.VENDOR_SERVICE_URL || "http://localhost:3003",
    authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
    ratingServiceClientId: process.env.RATING_SERVICE_CLIENT_ID || "rating-service-id",
    ratingServiceClientSecret: process.env.RATING_SERVICE_CLIENT_SECRET || "rating-service-secret",
    authServiceTokenUrl:
        process.env.AUTH_SERVICE_TOKEN_URL || `${process.env.AUTH_SERVICE_URL || "http://localhost:3001"}/oauth/token`,
    rabbitMQUrl: process.env.RABBITMQ_URL || "amqp://localhost",
};

export const ratingServiceAuthenticator = new ServiceAuthenticator(
    config.ratingServiceClientId,
    config.ratingServiceClientSecret,
    config.authServiceTokenUrl,
    "RatingService"
);
