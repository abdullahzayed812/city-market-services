import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const env = {
  baseUrl: (process.env.BASE_URL || "http://localhost:3000/api/v1").replace(/\/$/, ""),
  testDataPrefix: process.env.TEST_DATA_PREFIX || "loadtest",
  seedAccountsPassword: process.env.SEED_ACCOUNTS_PASSWORD || "password123",
  allowProductionLoadTest: process.env.ALLOW_PRODUCTION_LOAD_TEST === "true",
  loadTestMode: process.env.LOAD_TEST_MODE !== "false",

  // Pre-existing DELIVERY_MANAGER accounts (see services/auth-service/src/infrastructure/database/seed-db.ts).
  // Delivery offices have no creation API - direct-DB-seed-only - so seeding/cleanup
  // authenticate as these to act on couriers and deliveries. Defaults match the
  // repository's own committed local-dev seed data (already public in seed-db.ts),
  // never a production secret - override for any non-local environment.
  deliveryManagerEmails: (process.env.DELIVERY_MANAGER_EMAILS || "deliverymanager@citymarket.com,deliverymanager2@citymarket.com,deliverymanager3@citymarket.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  required,
};
