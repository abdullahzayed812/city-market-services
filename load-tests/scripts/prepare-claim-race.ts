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
import { createApiClient } from "./lib/http";
import { writeCsv } from "./lib/csv";
import { createClaimableDelivery } from "./lib/race-target";

const DATA_DIR = path.resolve(__dirname, "../data/generated");

async function main() {
  assertSafeToRun(env.baseUrl, "prepare-claim-race");

  const client = createApiClient();
  const deliveryId = await createClaimableDelivery(client);

  writeCsv(path.join(DATA_DIR, "race-target.csv"), [{ deliveryId }]);
  console.log(`\nDone. deliveryId=${deliveryId} written to data/generated/race-target.csv`);
}

main().catch((err) => {
  console.error("\nprepare-claim-race failed:", err.message);
  process.exit(1);
});
