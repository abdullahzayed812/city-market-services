/**
 * Prepares the shared target for tests/concurrency-claim-race.yml (Phase 18).
 *
 * Artillery has no built-in way for many independent virtual users to coordinate
 * on "attack the exact same record" - each VU only knows what its own payload row
 * gives it. So this script does the setup OUTSIDE Artillery: places one real order
 * against a seeded vendor product, logs in as that product's owning vendor to
 * accept + confirm it (the same real transition used in tests/order-lifecycle.yml -
 * PENDING -> PREPARING -> CONFIRMED, which fires ORDER_READY), then polls
 * GET /delivery/deliveries/pending until delivery-service's event consumer has
 * created the resulting Delivery row, and writes its id to
 * data/generated/race-target.csv (a single row). The concurrency test's
 * config.payload reads that one row with every delivery-manager VU, so they all
 * PATCH .../accept on the exact same delivery at (as close to) the same time.
 *
 * Usage:
 *   npm run loadtest:prepare-race
 *   npm run loadtest:concurrency
 * Prerequisite: `npm run loadtest:seed` (needs at least one seeded vendor product).
 */
import * as path from "path";
import { env } from "./lib/env";
import { assertSafeToRun } from "./lib/safety";
import { createApiClient, authHeader, registerAccount, loginAccount, withRetry, sleep } from "./lib/http";
import { readCsv, writeCsv } from "./lib/csv";

const DATA_DIR = path.resolve(__dirname, "../data/generated");

async function main() {
  assertSafeToRun(env.baseUrl, "prepare-claim-race");

  const products = readCsv(path.join(DATA_DIR, "vendor-products-with-owner.csv"));
  if (!products.length) {
    console.error("No data/generated/vendor-products-with-owner.csv found - run `npm run loadtest:seed` first.");
    process.exit(1);
  }
  const product = products[Math.floor(Math.random() * products.length)];

  const client = createApiClient();

  console.log("Registering a customer and placing an order...");
  const customer = await registerAccount(client, "CUSTOMER", "race-setup");
  const item: Record<string, any> =
    product.measurementType === "WEIGHT" ? { vendorProductId: product.vendorProductId, weightGrams: 500 } : { vendorProductId: product.vendorProductId, quantity: 1 };

  const orderRes = await withRetry(
    () =>
      client.post(
        "/orders",
        { items: [item], deliveryAddress: "Race setup order, Borg El Arab", deliveryLatitude: 30.87, deliveryLongitude: 29.53 },
        authHeader(customer.accessToken),
      ),
    "POST /orders",
  );
  const orderId = orderRes.data.data.order.id;
  const vendorOrderId = orderRes.data.data.vendorOrders[0].id;
  console.log(`  orderId=${orderId} vendorOrderId=${vendorOrderId}`);

  console.log(`Logging in as the owning vendor (${product.vendorEmail}) to accept + confirm...`);
  const vendor = await loginAccount(client, product.vendorEmail, product.vendorPassword);
  await withRetry(() => client.post(`/orders/vendor-orders/${vendorOrderId}/accept`, {}, authHeader(vendor.accessToken)), "accept vendor order");
  await withRetry(
    () => client.patch(`/orders/vendor-orders/${vendorOrderId}/status`, { status: "CONFIRMED" }, authHeader(vendor.accessToken)),
    "confirm vendor order",
  );

  // GET /delivery/deliveries/pending is ADMIN/DELIVERY_MANAGER/COURIER-only (verified
  // against the live API: a VENDOR token gets 401 "Insufficient permissions") - need
  // a delivery-manager account to poll it, not the vendor we just used above.
  console.log("Polling GET /delivery/deliveries/pending until the delivery appears (waiting on the ORDER_READY -> Delivery RabbitMQ hop)...");
  const manager = await loginAccount(client, env.deliveryManagerEmails[0], env.seedAccountsPassword);
  let deliveryId: string | null = null;
  for (let attempt = 0; attempt < 15 && !deliveryId; attempt++) {
    await sleep(1000);
    const pendingRes = await withRetry(() => client.get("/delivery/deliveries/pending", authHeader(manager.accessToken)), "GET /delivery/deliveries/pending");
    const match = (pendingRes.data.data || []).find((d: any) => d.customerOrderId === orderId);
    if (match) deliveryId = match.id;
  }

  if (!deliveryId) {
    console.error("Delivery never appeared in the pending list within 15s - is delivery-service's OrderReadyConsumer running and consuming RabbitMQ?");
    process.exit(1);
  }

  writeCsv(path.join(DATA_DIR, "race-target.csv"), [{ deliveryId }]);
  console.log(`\nDone. deliveryId=${deliveryId} written to data/generated/race-target.csv`);
}

main().catch((err) => {
  console.error("\nprepare-claim-race failed:", err.message);
  process.exit(1);
});
