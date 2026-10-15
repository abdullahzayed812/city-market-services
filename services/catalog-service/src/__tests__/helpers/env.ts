// Imported first by tests that load config/env: values for the required settings, so the
// tests never depend on (or read secrets from) a local .env
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_SERVICE_ACCESS_SECRET = "test-service-secret";
process.env.DB_USER = process.env.CATALOG_TEST_DB_USER ?? "test";
process.env.DB_PASSWORD = process.env.CATALOG_TEST_DB_PASSWORD ?? "test";
process.env.CATALOG_SERVICE_CLIENT_SECRET = "test-client-secret";
process.env.VENDOR_SERVICE_URL = "http://vendor-service.test";
process.env.MEDIA_SERVICE_URL = "http://media-service.test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";
