export const config = {
  port: process.env.PORT || 3001,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: parseInt(process.env.DB_PORT || "3306"),
  dbUser: process.env.DB_USER || "abdo",
  dbPassword: process.env.DB_PASSWORD || "password",
  dbName: process.env.DB_NAME || "auth_db",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "access_secret_key",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "refresh_secret_key",
  jwtAccessExpiry: "7d",
  jwtRefreshExpiry: "7d",
  jwtServiceAccessSecret: process.env.JWT_SERVICE_ACCESS_SECRET || "service_access_secret_key", // New secret for service tokens
  jwtServiceAccessExpiry: "15m", // New: Short expiry for service tokens

  // --- Service Client Configuration ---
  registeredServiceClients: [
    {
      clientId: process.env.ADMIN_SERVICE_CLIENT_ID || "admin-service-id",
      clientSecret: process.env.ADMIN_SERVICE_CLIENT_SECRET || "admin-service-secret",
      scope: "admin", // Define what this service can access/do
    },
    {
      clientId: process.env.ORDER_SERVICE_CLIENT_ID || "order-service-id",
      clientSecret: process.env.ORDER_SERVICE_CLIENT_SECRET || "order-service-secret",
      scope: "order", // Example scope
    },
    {
      clientId: process.env.DELIVERY_SERVICE_CLIENT_ID || "delivery-service-id",
      clientSecret: process.env.DELIVERY_SERVICE_CLIENT_SECRET || "delivery-service-secret",
      scope: "delivery", // Example scope
    },
    {
      clientId: process.env.WEBSOCKET_GATEWAY_CLIENT_ID || "websocket-gateway-id",
      clientSecret: process.env.WEBSOCKET_GATEWAY_CLIENT_SECRET || "websocket-gateway-secret",
      scope: "websocket", // Example scope
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
    // Add other services as they are configured
  ],
  // --- End Service Client Configuration ---
};
