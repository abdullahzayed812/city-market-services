/**
 * Removes load-test-generated data, scoped ONLY to the accounts/products recorded
 * in data/generated/*.csv by scripts/seed.ts (never a broad sweep over the whole
 * database, and never a raw SQL DELETE).
 *
 * IMPORTANT, VERIFIED LIMITATION: no service in this codebase exposes an endpoint
 * to permanently delete a user (grepped auth-service's routes/controller - only
 * PATCH /auth/users/:id/status exists, which flips `is_active`). "Cleanup" for
 * customer/vendor/courier accounts therefore means DEACTIVATING them
 * (isActive = false), not deleting the row. This is the most complete cleanup
 * achievable through the real API surface - documented here rather than papered
 * over with an invented delete endpoint. Vendor-created catalog products DO have a
 * real DELETE /catalog/products/:id, which this script uses (as the owning vendor,
 * self-service - matching normal usage even though the route itself has no
 * role-level guard beyond being authenticated).
 *
 * Usage:
 *   npm run loadtest:cleanup
 */
import * as path from "path";
import { env } from "./lib/env";
import { assertSafeToRun } from "./lib/safety";
import { createApiClient, authHeader, loginAccount, sleep, withRetry } from "./lib/http";
import { readCsv } from "./lib/csv";

const DATA_DIR = path.resolve(__dirname, "../data/generated");
const REQUEST_DELAY_MS = Number(process.env.SEED_REQUEST_DELAY_MS || 150);

// SECURITY FINDING (out of scope to fix here, flagged in the implementation report):
// auth.routes.ts registers PATCH /users/:id/status with NO `authenticate` middleware
// at all (unlike /logout, /logout-all, /sessions on the same router) - it is callable
// by anyone who knows a user id, not just admins. This script relies on that same
// endpoint purely to deactivate its OWN load-test-generated accounts; it does not
// exploit it against anything else. Recommend the team add an auth+ADMIN guard to
// this route independent of anything in load-tests/.
async function deactivateUsers(client: ReturnType<typeof createApiClient>, csvFile: string, label: string) {
  const rows = readCsv(path.join(DATA_DIR, csvFile));
  if (!rows.length) {
    console.log(`-- ${label}: nothing to clean up (${csvFile} not found or empty) --`);
    return;
  }
  console.log(`\n-- Deactivating ${rows.length} ${label} accounts --`);
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await withRetry(
        () => client.patch(`/auth/users/${row.userId}/status`, { status: "inactive" }),
        `PATCH /auth/users/${row.userId}/status`,
      );
      ok++;
    } catch (err: any) {
      failed++;
      console.warn(`  failed to deactivate ${row.email} (${row.userId}): ${err.message}`);
    }
    process.stdout.write(`\r  ${ok + failed}/${rows.length} (${failed} failed)`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();
}

async function deleteVendorProducts(client: ReturnType<typeof createApiClient>) {
  const vendors = readCsv(path.join(DATA_DIR, "vendors.csv"));
  const products = readCsv(path.join(DATA_DIR, "vendor-products.csv"));
  if (!vendors.length || !products.length) {
    console.log("-- vendor products: nothing to clean up --");
    return;
  }
  console.log(`\n-- Deleting ${products.length} seeded vendor products --`);

  const tokenByVendorId = new Map<string, string>();
  for (const v of vendors) {
    try {
      const account = await loginAccount(client, v.email, v.password);
      tokenByVendorId.set(v.vendorId, account.accessToken);
    } catch (err: any) {
      console.warn(`  could not log in as vendor ${v.email} to delete its products: ${err.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  let ok = 0;
  let failed = 0;
  for (const p of products) {
    const token = tokenByVendorId.get(p.vendorId);
    if (!token) {
      failed++;
      continue;
    }
    try {
      await withRetry(
        () => client.delete(`/catalog/products/${p.vendorProductId}`, authHeader(token)),
        `DELETE /catalog/products/${p.vendorProductId}`,
      );
      ok++;
    } catch (err: any) {
      failed++;
      console.warn(`  failed to delete product ${p.vendorProductId}: ${err.message}`);
    }
    process.stdout.write(`\r  ${ok + failed}/${products.length} (${failed} failed)`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();
}

async function main() {
  assertSafeToRun(env.baseUrl, "cleanup");
  console.log(`Target: ${env.baseUrl}`);
  console.log(`Reading generated data from: ${DATA_DIR}`);

  const client = createApiClient();

  await deleteVendorProducts(client);
  await deactivateUsers(client, "customers.csv", "customer");
  await deactivateUsers(client, "vendors.csv", "vendor");
  await deactivateUsers(client, "couriers.csv", "courier");

  console.log("\nDone. delivery-managers.csv was left untouched (those are pre-existing repo seed accounts, not load-test-generated).");
}

main().catch((err) => {
  console.error("\nCleanup failed:", err.message);
  process.exit(1);
});
