/**
 * Prepares tests/freelance-claim-race.yml: several approved, online freelancers and
 * one claimable delivery that the delivery offices and the freelancers will all try
 * to take at once.
 *
 * delivery-service must run with FREELANCE_ENABLED=true and OFFICE_PRIORITY_WINDOW_MINS=0
 * (so the delivery is claimable immediately). Freelancers report the delivery address
 * below as their location; set FREELANCE_RADIUS_KM=0 if your seeded vendors are far from it.
 *
 * Usage:
 *   npm run loadtest:prepare-freelance-race -- --freelancers 5
 *   npm run loadtest:freelance-race
 * Prerequisite: `npm run loadtest:seed` (needs at least one seeded vendor product).
 */
import * as path from "path";
import { randomUUID } from "crypto";
import { env } from "./lib/env";
import { assertSafeToRun } from "./lib/safety";
import { createApiClient, authHeader, registerAccount, loginAccount, withRetry } from "./lib/http";
import { writeCsv } from "./lib/csv";
import { createClaimableDelivery } from "./lib/race-target";

const DATA_DIR = path.resolve(__dirname, "../data/generated");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@citymarket.com";

function argNumber(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? parseInt(process.argv[index + 1], 10) || fallback : fallback;
}

async function main() {
  assertSafeToRun(env.baseUrl, "prepare-freelance-race");
  const count = argNumber("freelancers", 5);
  const client = createApiClient();

  console.log(`Logging in as admin (${ADMIN_EMAIL}) to approve freelancers...`);
  const admin = await loginAccount(client, ADMIN_EMAIL, process.env.ADMIN_PASSWORD || env.seedAccountsPassword);

  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const account = await registerAccount(client, "COURIER", "freelancer");
    const courierRes = await withRetry(
      () =>
        client.post(
          "/delivery/couriers/freelance/register",
          {
            fullName: `${env.testDataPrefix} Freelancer ${i + 1}`,
            phone: `+2012${randomUUID().replace(/\D/g, "").slice(0, 8)}`,
            // Placeholder: document review isn't exercised by this test
            nationalIdUrl: `https://example.invalid/courier-documents/${randomUUID()}/large.webp`,
            vehicleType: "Bicycle",
          },
          authHeader(account.accessToken),
        ),
      "POST /delivery/couriers/freelance/register",
    );
    const courierId = courierRes.data.data.id;
    await withRetry(() => client.patch(`/admin/couriers/${courierId}/approval`, { approvalStatus: "APPROVED" }, authHeader(admin.accessToken)), "approve freelancer");
    await withRetry(() => client.patch("/delivery/couriers/me/availability", { isAvailable: true }, authHeader(account.accessToken)), "go online");
    await withRetry(() => client.patch("/delivery/couriers/me/location", { latitude: 30.87, longitude: 29.53 }, authHeader(account.accessToken)), "report location");
    rows.push({ email: account.email, password: account.password, courierId });
    process.stdout.write(`\r  freelancers ready: ${i + 1}/${count}`);
  }
  console.log();
  writeCsv(path.join(DATA_DIR, "freelancers.csv"), rows);

  const deliveryId = await createClaimableDelivery(client);
  writeCsv(path.join(DATA_DIR, "race-target.csv"), [{ deliveryId }]);
  console.log(`\nDone. ${count} freelancers in data/generated/freelancers.csv, deliveryId=${deliveryId} in race-target.csv`);
}

main().catch((err) => {
  console.error("\nprepare-freelance-race failed:", err.response?.data?.message || err.message);
  process.exit(1);
});
