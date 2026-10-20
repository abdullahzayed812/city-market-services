import { ConfigLoader, ServiceAuthenticator } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  firebaseServiceAccountJson: string;
  firebaseServiceAccountPath: string;
  authServiceUrl: string;
  authServiceTokenUrl: string;
  notificationServiceClientId: string;
  notificationServiceClientSecret: string;
}>({
  port: { env: "PORT", default: 3008 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "notification_db" },
  firebaseServiceAccountJson: { env: "FIREBASE_SERVICE_ACCOUNT_JSON", default: "" },
  firebaseServiceAccountPath: { env: "FIREBASE_SERVICE_ACCOUNT_PATH", default: "" },
  // Admin notifications go to every active ADMIN account, read from auth-service
  authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
  authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
  notificationServiceClientId: { env: "NOTIFICATION_SERVICE_CLIENT_ID", default: "notification-service-id" },
  notificationServiceClientSecret: { env: "NOTIFICATION_SERVICE_CLIENT_SECRET", default: "notification-service-secret", sensitive: true },
});

export const notificationServiceAuthenticator = new ServiceAuthenticator(
  config.notificationServiceClientId,
  config.notificationServiceClientSecret,
  config.authServiceTokenUrl,
  "NotificationService",
);
