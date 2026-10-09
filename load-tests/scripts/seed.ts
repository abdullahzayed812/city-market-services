/**
 * Generates isolated, clearly-prefixed test data through the real APIs (never
 * direct SQL) so load tests have a realistic, stable population to run against
 * instead of hammering empty catalogs or racing to create their own data.
 *
 * Usage:
 *   npm run loadtest:seed                       (defaults: 300 customers, 20 vendors, 10 couriers)
 *   npm run loadtest:seed -- --customers 600 --vendors 40 --couriers 20 --orders 0
 *
 * What this creates and how (all ground-truthed against the real services -
 * see the header comments in scenarios/*.yml for the exact endpoints):
 *   - Customers: self-registered CUSTOMER accounts. Written to
 *     data/generated/customers.csv. This is the pool every customer VU logs in
 *     from - load tiers never register accounts live. Keep it well above the
 *     tier's concurrent-session count (scripts/run-test.ts enforces 2x).
 *   - Vendors: self-registered VENDOR accounts, each given a vendor profile
 *     (POST /vendors) and a batch of real catalog products
 *     (POST /catalog/products/vendor/:id/bulk-add-global with a real globalCategoryId).
 *     Written to data/generated/vendors.csv and data/generated/vendor-products.csv -
 *     the latter is what scenarios/customer-order.yml draws real, orderable
 *     vendorProductIds from via config.payload.
 *   - Couriers: delivery-service has NO self-service courier registration - a
 *     Courier profile can only be created by an ADMIN or DELIVERY_MANAGER
 *     (POST /delivery/couriers). This script logs in as each of the
 *     pre-seeded delivery-manager accounts (services/auth-service/.../seed-db.ts)
 *     in turn to create courier profiles for freshly self-registered COURIER auth
 *     accounts, so couriers are spread across offices. Written to
 *     data/generated/couriers.csv with the owning office's login (officeEmail).
 *   - Delivery offices: NOT created here. There is no API to create one (only
 *     GET /delivery/delivery-offices, ADMIN-only, exists) - the three offices that
 *     ship in the repo's own seed data are the only ones available unless you seed
 *     more directly into the delivery_offices table yourself (see data/README.md).
 *     data/generated/delivery-managers.csv just records the fixed accounts so the
 *     delivery-office scenario/tests can draw from it like any other payload pool.
 *   - Orders (--orders N, default 0): optionally pre-places N orders spread across
 *     the seeded customers/vendor-products, useful for warming up a vendor's order
 *     queue before running the vendor scenario in isolation.
 *
 * Respects nginx's rate limits (see README "Known limitations": the "auth" zone is
 * 10 req/min/IP) by pacing registration calls - expect seeding hundreds of accounts
 * against anything other than api-gateway directly to take a while. Point BASE_URL
 * at the gateway (default) rather than nginx for bulk seeding.
 */
import { randomUUID } from "crypto";
import * as path from "path";
import { env } from "./lib/env";
import { assertSafeToRun } from "./lib/safety";
import { createApiClient, authHeader, registerAccount, loginAccount, sleep, withRetry, RegisteredAccount } from "./lib/http";
import { writeCsv } from "./lib/csv";

const DATA_DIR = path.resolve(__dirname, "../data/generated");
const REQUEST_DELAY_MS = Number(process.env.SEED_REQUEST_DELAY_MS || 150);

interface Args {
  customers: number;
  vendors: number;
  couriers: number;
  orders: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: number) => {
    const i = args.indexOf(`--${flag}`);
    return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : fallback;
  };
  return {
    customers: get("customers", 300),
    vendors: get("vendors", 20),
    couriers: get("couriers", 10),
    orders: get("orders", 0),
  };
}

async function seedCustomers(client: ReturnType<typeof createApiClient>, count: number) {
  console.log(`\n-- Seeding ${count} customers --`);
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const account = await registerAccount(client, "CUSTOMER", "customer");
    // The customer apps create the user-service profile right after register
    // (web/customer userService.createCustomer). Without it every order logs
    // customer_not_found from the COD-penalty check and delivery can't fetch the
    // customer's phone - i.e. the order path isn't the production one.
    await withRetry(
      () =>
        client.post(
          "/users/customers",
          { fullName: `${env.testDataPrefix} Customer ${i + 1}`, phone: `+2012${String(randomUUID().replace(/\D/g, "")).slice(0, 8).padEnd(8, "0")}` },
          authHeader(account.accessToken),
        ),
      "POST /users/customers",
    );
    rows.push({ email: account.email, password: account.password, userId: account.userId });
    process.stdout.write(`\r  ${i + 1}/${count}`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();
  writeCsv(path.join(DATA_DIR, "customers.csv"), rows);
  return rows;
}

async function fetchGlobalCategoryIds(client: ReturnType<typeof createApiClient>, token: string): Promise<string[]> {
  const res = await withRetry(() => client.get("/catalog/categories/global", authHeader(token)), "GET /catalog/categories/global");
  const categories: any[] = res.data.data || [];
  if (!categories.length) {
    throw new Error("No global categories found - is catalog-service seeded? Run `npm run db:seed` at the repo root first.");
  }
  return categories.map((c) => c.id);
}

/**
 * Builds real, orderable bulk-add-global items instead of relying on the
 * endpoint's `{globalCategoryId}`-only shortcut. Verified directly against the
 * live API that the shortcut path (vendor-product.controller.ts:bulkAddFromGlobal
 * auto-deriving `items` from the category) supplies no price/stock, and
 * vendor-product.repository.ts:bulkAddFromGlobalProducts defaults every
 * unspecified item to price=0/stock=0/isAvailable=false - i.e. never orderable.
 */
async function buildOrderableBulkAddItems(
  client: ReturnType<typeof createApiClient>,
  token: string,
  globalCategoryId: string,
  limit = 25,
): Promise<Array<{ globalProductId: string; price: number; stockQuantity?: number; stockWeightGrams?: number }>> {
  const res = await withRetry(
    () => client.get(`/catalog/global-products?globalCategoryId=${globalCategoryId}&page=1&limit=${limit}`, authHeader(token)),
    "GET /catalog/global-products",
  );
  const globalProducts: any[] = res.data.data?.data || [];
  return globalProducts.map((gp) => {
    const price = Math.round((5 + Math.random() * 95) * 100) / 100; // 5.00-100.00
    // Stock is sized for repeated load runs: baseline alone places ~300 orders of
    // 1-4 units, and a dev DB with only a couple of global products concentrates
    // them on very few rows. Running out mid-run turns into insufficient_stock 400s
    // that measure the seed, not the system.
    if (gp.measurementType === "WEIGHT") {
      return { globalProductId: gp.id, price, stockWeightGrams: 200_000 + Math.floor(Math.random() * 300_000) }; // 200-500kg on hand
    }
    return { globalProductId: gp.id, price, stockQuantity: 2000 + Math.floor(Math.random() * 3000) }; // 2000-5000 units on hand
  });
}

/**
 * DISCOVERED WHILE VALIDATING THIS SUITE AGAINST A REAL DOCKER-COMPOSE STACK
 * (not a guess): a freshly `npm run db:seed`-ed environment has ZERO rows in
 * `global_products`. catalog-service's own seed-db.ts has its product-generation
 * block commented out (lines ~373-384: `// const seeder = new ProductSeeder(conn);`
 * and the calls around it), and there is no CSV committed for the alternate
 * `db:import-global-products` path. Every route that can create a vendor product -
 * `POST /catalog/products/vendor/:id/bulk-add-global` AND direct
 * `POST /catalog/products` (whose CreateVendorProductDto requires a real
 * `globalProductId`) - is unusable without at least one global product existing.
 * Failing fast here with a clear fix beats a confusing "items_required" 400 deep
 * inside the vendor loop.
 */
async function assertGlobalProductsExist(client: ReturnType<typeof createApiClient>, token: string): Promise<void> {
  const res = await withRetry(() => client.get("/catalog/global-products?page=1&limit=1", authHeader(token)), "GET /catalog/global-products");
  const total = res.data.data?.total ?? 0;
  if (total > 0) return;

  throw new Error(
    [
      "No global products exist in this environment (GET /catalog/global-products returned 0).",
      "Every vendor-product-creation route depends on at least one existing global product,",
      "so `npm run loadtest:seed` cannot onboard vendors with real products here.",
      "",
      "This is a gap in the target environment's seed data, not this script - fix one of:",
      "  1. Uncomment the ProductSeeder block in",
      "     services/catalog-service/src/infrastructure/database/seed-db.ts (~line 373-384)",
      "     and re-run `npm run db:seed` (rebuild catalog-service first if it's containerized).",
      "  2. Supply your own CSV and run",
      "     `npm run db:import-global-products -- <path-to-csv>` at the repo root.",
    ].join("\n"),
  );
}

async function seedVendors(client: ReturnType<typeof createApiClient>, count: number) {
  console.log(`\n-- Seeding ${count} vendors (profile + real catalog products each) --`);
  const vendorRows: Record<string, string>[] = [];
  const productRows: Record<string, string>[] = [];
  const productsWithOwnerRows: Record<string, string>[] = [];
  let categoryIds: string[] | null = null;

  for (let i = 0; i < count; i++) {
    const account = await registerAccount(client, "VENDOR", "vendor");

    const vendorRes = await withRetry(
      () =>
        client.post(
          "/vendors",
          {
            shopName: `${env.testDataPrefix} Vendor ${i + 1}`,
            shopDescription: "Synthetic vendor created by the load-testing suite",
            phone: `+2010${String(randomUUID().replace(/\D/g, "")).slice(0, 8)}`,
            address: "Borg El Arab load-test site",
            latitude: 30.87 + Math.random() * 0.02,
            longitude: 29.53 + Math.random() * 0.02,
          },
          authHeader(account.accessToken),
        ),
      "POST /vendors",
    );
    const vendorId = vendorRes.data.data.id;

    if (!categoryIds) {
      categoryIds = await fetchGlobalCategoryIds(client, account.accessToken);
    }
    // Many global categories can have zero global products (e.g. a dev DB with only
    // a handful imported), and bulk-add-global rejects an empty list with
    // "items_required" - so rotate through categories until one yields products.
    let items: Awaited<ReturnType<typeof buildOrderableBulkAddItems>> = [];
    for (let c = 0; c < categoryIds.length && !items.length; c++) {
      const globalCategoryId = categoryIds[(i + c) % categoryIds.length];
      items = await buildOrderableBulkAddItems(client, account.accessToken, globalCategoryId);
    }
    if (!items.length) {
      throw new Error("No global category has any global products - see assertGlobalProductsExist() for how to populate them.");
    }

    await withRetry(
      () => client.post(`/catalog/products/vendor/${vendorId}/bulk-add-global`, { items }, authHeader(account.accessToken)),
      "POST /catalog/products/vendor/:id/bulk-add-global",
    );

    const productsRes = await withRetry(
      () => client.get(`/catalog/products/vendor/${vendorId}?page=1&limit=50`, authHeader(account.accessToken)),
      "GET /catalog/products/vendor/:id",
    );
    // Only keep genuinely orderable products - catalog-service's synthetic product
    // generator (ProductFactory) deliberately produces some zero-stock/unavailable
    // listings for UI-state realism, and POST /orders rejects those with
    // "product_not_available" (verified directly against the live API, not a
    // guess). A load test should exercise real order-placement capacity, not spend
    // its run mostly hitting an expected business-rule 400.
    const allProducts: any[] = productsRes.data.data.data || [];
    const products = allProducts.filter(
      (p) => p.isAvailable && (p.measurementType === "WEIGHT" ? p.stockWeightGrams > 0 : p.stockQuantity > 0),
    );
    for (const p of products) {
      productRows.push({ vendorId, vendorProductId: p.id, measurementType: p.measurementType });
      productsWithOwnerRows.push({
        vendorEmail: account.email,
        vendorPassword: account.password,
        vendorId,
        vendorProductId: p.id,
        measurementType: p.measurementType,
      });
    }

    vendorRows.push({ email: account.email, password: account.password, userId: account.userId, vendorId });
    process.stdout.write(`\r  ${i + 1}/${count} (${products.length} products)`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();
  writeCsv(path.join(DATA_DIR, "vendors.csv"), vendorRows);
  writeCsv(path.join(DATA_DIR, "vendor-products.csv"), productRows);
  // Joined view (one row per product, carrying its OWNING vendor's own login) -
  // used by tests/order-lifecycle.yml and tests/concurrency-claim-race.yml, which
  // need the vendor that logs in to accept an order to be the exact same vendor
  // whose product was ordered - the plain vendors.csv/vendor-products.csv pair
  // above are independent random draws and don't guarantee that alignment.
  writeCsv(path.join(DATA_DIR, "vendor-products-with-owner.csv"), productsWithOwnerRows);
  return { vendorRows, productRows };
}

async function seedCouriers(client: ReturnType<typeof createApiClient>, count: number) {
  console.log(`\n-- Seeding ${count} couriers --`);
  // A manager creates couriers in their own office, and can only assign its own
  // couriers, so spread couriers round-robin across offices and record which office
  // each belongs to (tests/order-lifecycle.yml logs in as that office to assign).
  console.log(`  Authenticating as ${env.deliveryManagerEmails.length} delivery manager(s) to create courier profiles...`);
  const managers = [];
  for (const email of env.deliveryManagerEmails) {
    managers.push(await loginAccount(client, email, env.seedAccountsPassword));
  }

  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const manager = managers[i % managers.length];
    const account = await registerAccount(client, "COURIER", "courier");
    const courierRes = await withRetry(
      () =>
        client.post(
          "/delivery/couriers",
          {
            userId: account.userId,
            fullName: `${env.testDataPrefix} Courier ${i + 1}`,
            phone: `+2011${String(randomUUID().replace(/\D/g, "")).slice(0, 8)}`,
          },
          authHeader(manager.accessToken),
        ),
      "POST /delivery/couriers",
    );
    rows.push({
      email: account.email,
      password: account.password,
      userId: account.userId,
      courierId: courierRes.data.data.id,
      officeEmail: manager.email,
    });
    process.stdout.write(`\r  ${i + 1}/${count}`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();
  writeCsv(path.join(DATA_DIR, "couriers.csv"), rows);
  return rows;
}

function seedDeliveryManagers() {
  const rows = env.deliveryManagerEmails.map((email) => ({ email, password: env.seedAccountsPassword }));
  writeCsv(path.join(DATA_DIR, "delivery-managers.csv"), rows);
  console.log(`\n-- Wrote ${rows.length} pre-existing delivery-manager accounts to delivery-managers.csv --`);
  console.log("   (delivery offices cannot be created via API - see data/README.md if you need more than 3)");
}

async function seedOrders(
  client: ReturnType<typeof createApiClient>,
  customers: RegisteredAccount[],
  productRows: Record<string, string>[],
  count: number,
) {
  if (count <= 0 || !customers.length || !productRows.length) return;
  console.log(`\n-- Pre-placing ${count} orders --`);
  for (let i = 0; i < count; i++) {
    const customer = customers[i % customers.length];
    const product = productRows[Math.floor(Math.random() * productRows.length)];
    const item: Record<string, any> = { vendorProductId: product.vendorProductId };
    if (product.measurementType === "WEIGHT") item.weightGrams = 500;
    else item.quantity = 1;

    await withRetry(
      () =>
        client.post(
          "/orders",
          {
            items: [item],
            deliveryAddress: "Load test seeded order, Borg El Arab",
            deliveryLatitude: 30.87,
            deliveryLongitude: 29.53,
          },
          authHeader(customer.accessToken),
        ),
      "POST /orders",
    );
    process.stdout.write(`\r  ${i + 1}/${count}`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log();
}

async function main() {
  const args = parseArgs();
  assertSafeToRun(env.baseUrl, "seed");

  console.log(`Target: ${env.baseUrl}`);
  console.log(`Prefix: ${env.testDataPrefix}`);
  console.log(`Plan:   customers=${args.customers} vendors=${args.vendors} couriers=${args.couriers} orders=${args.orders}`);

  const client = createApiClient();

  if (args.vendors > 0) {
    const probe = await registerAccount(client, "CUSTOMER", "probe");
    await assertGlobalProductsExist(client, probe.accessToken);
  }

  // A section with count 0 is skipped entirely so its existing CSV is kept (e.g.
  // `--vendors 0 --couriers 0` refreshes only the customer pool).
  const customerRows = args.customers > 0 ? await seedCustomers(client, args.customers) : [];
  const { productRows } = args.vendors > 0 ? await seedVendors(client, args.vendors) : { productRows: [] };
  if (args.couriers > 0) await seedCouriers(client, args.couriers);
  seedDeliveryManagers();

  if (args.orders > 0) {
    // Orders need live access tokens, not just CSV rows - log the customers back in.
    const customerAccounts: RegisteredAccount[] = [];
    for (const row of customerRows) {
      customerAccounts.push(await loginAccount(client, row.email, row.password));
      await sleep(REQUEST_DELAY_MS);
    }
    await seedOrders(client, customerAccounts, productRows, args.orders);
  }

  console.log(`\nDone. Generated data written to ${DATA_DIR}`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
