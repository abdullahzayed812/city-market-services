export const config = {
  port: process.env.PORT || 3005,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: parseInt(process.env.DB_PORT || "3306"),
  dbUser: process.env.DB_USER || "abdo",
  dbPassword: process.env.DB_PASSWORD || "password",
  dbName: process.env.DB_NAME || "order_db",
  catalogServiceUrl: process.env.CATALOG_SERVICE_URL || "http://localhost:3004",
  vendorServiceUrl: process.env.VENDOR_SERVICE_URL || "http://localhost:3003",
};
