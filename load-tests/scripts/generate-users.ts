/**
 * Thin, single-purpose wrapper around scripts/seed.ts's customer registration for
 * when you only need a pool of authenticated CUSTOMER credentials (e.g. to feed
 * config.payload in a scenario that should hit a large, stable set of distinct
 * accounts rather than self-registering fresh ones every run - remember auth is
 * single-session-per-user, so a stable pool only helps when each VU gets its own
 * row; see processors/auth.ts).
 *
 * Usage:
 *   npm run loadtest:generate-users -- --count 500 --role CUSTOMER
 *
 * Writes data/generated/<role-lowercase>-pool.csv with {email,password,userId}.
 * For VENDOR/COURIER accounts this does NOT create the vendor/courier profile or
 * catalog products - use `npm run loadtest:seed` for the fully-onboarded version.
 */
import * as path from "path";
import { env } from "./lib/env";
import { assertSafeToRun } from "./lib/safety";
import { createApiClient, registerAccount, sleep } from "./lib/http";
import { writeCsv } from "./lib/csv";

const DATA_DIR = path.resolve(__dirname, "../data/generated");
const REQUEST_DELAY_MS = Number(process.env.SEED_REQUEST_DELAY_MS || 150);

function parseArgs() {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf("--count");
  const roleIdx = args.indexOf("--role");
  const count = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) : 100;
  const role = ((roleIdx >= 0 ? args[roleIdx + 1] : "CUSTOMER") as string).toUpperCase();
  if (!["CUSTOMER", "VENDOR", "COURIER"].includes(role)) {
    throw new Error(`Unsupported --role ${role}. Must be one of CUSTOMER, VENDOR, COURIER.`);
  }
  return { count, role: role as "CUSTOMER" | "VENDOR" | "COURIER" };
}

async function main() {
  const { count, role } = parseArgs();
  assertSafeToRun(env.baseUrl, "generate-users");

  console.log(`Target: ${env.baseUrl}`);
  console.log(`Registering ${count} ${role} accounts...`);

  const client = createApiClient();
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const account = await registerAccount(client, role, role.toLowerCase());
    rows.push({ email: account.email, password: account.password, userId: account.userId });
    process.stdout.write(`\r  ${i + 1}/${count}`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();

  const outFile = path.join(DATA_DIR, `${role.toLowerCase()}-pool.csv`);
  writeCsv(outFile, rows);
  console.log(`Wrote ${rows.length} accounts to ${outFile}`);
}

main().catch((err) => {
  console.error("\ngenerate-users failed:", err.message);
  process.exit(1);
});
