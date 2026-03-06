export const config = {
  port: process.env.PORT || 3000,
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  userServiceUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
  vendorServiceUrl: process.env.VENDOR_SERVICE_URL || "http://localhost:3003",
  catalogServiceUrl: process.env.CATALOG_SERVICE_URL || "http://localhost:3004",
  orderServiceUrl: process.env.ORDER_SERVICE_URL || "http://localhost:3005",
  deliveryServiceUrl: process.env.DELIVERY_SERVICE_URL || "http://localhost:3006",
  adminServiceUrl: process.env.ADMIN_SERVICE_URL || "http://localhost:3007",
  notificationsServiceUrl: process.env.NOTIFICATIONS_SERVICE_URL || "http://localhost:3008",
  ratingServiceUrl: process.env.RATING_SERVICE_URL || "http://localhost:3010",
  jwtSecret: process.env.JWT_SECRET || "access_secret_key",
};
