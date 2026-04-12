import { ConfigLoader } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
  port: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
}>({
  port: { env: "PORT", default: 3002 },
  dbHost: { env: "DB_HOST", default: "localhost" },
  dbPort: { env: "DB_PORT", default: 3306 },
  dbUser: { env: "DB_USER", required: true },
  dbPassword: { env: "DB_PASSWORD", required: true, sensitive: true },
  dbName: { env: "DB_NAME", default: "user_db" },
});
