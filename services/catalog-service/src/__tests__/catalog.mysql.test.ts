import { vendorsByToken, startApp, userToken } from "./helpers/http";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as mysql from "mysql2/promise";
import { MeasurementType, UserRole } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { VendorProductRepository } from "../infrastructure/repositories/vendor-product.repository";
import { GlobalProductRepository } from "../infrastructure/repositories/global-product.repository";
import { CategoryRepository } from "../infrastructure/repositories/category.repository";
import { ProductSubmissionRepository } from "../infrastructure/repositories/product-submission.repository";
import { ProductSubmissionTx } from "../core/interfaces/product-submission.repository";
import { CatalogService } from "../application/services/catalog.service";
import { ProductSubmissionService } from "../application/services/product-submission.service";
import { VendorProductController } from "../presentation/controllers/vendor-product.controller";
import { GlobalProductController } from "../presentation/controllers/global-product.controller";
import { ProductSubmissionController } from "../presentation/controllers/product-submission.controller";
import { createVendorProductRoutes } from "../presentation/routes/vendor-product.routes";
import { createGlobalProductRoutes } from "../presentation/routes/global-product.routes";
import { createProductSubmissionRoutes } from "../presentation/routes/product-submission.routes";
import { FakeEvents, FakeMedia, imageKeyFor } from "./helpers/fakes";

// Real MySQL (a throwaway database created from schema.sql and dropped afterwards).
// Run with CATALOG_TEST_DB_HOST / _PORT / _USER / _PASSWORD; skipped otherwise.
const host = process.env.CATALOG_TEST_DB_HOST;
const dbConfig = {
  host: host ?? "",
  port: Number(process.env.CATALOG_TEST_DB_PORT ?? 3306),
  user: process.env.CATALOG_TEST_DB_USER ?? "root",
  password: process.env.CATALOG_TEST_DB_PASSWORD ?? "",
};
const dbName = `catalog_it_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

// Fails the store-link step once (it runs after the global product insert, in the same
// transaction), to check the rollback
class InjectableRepo extends ProductSubmissionRepository {
  failVendorLink = false;
  withTransaction<T>(fn: (tx: ProductSubmissionTx) => Promise<T>): Promise<T> {
    return super.withTransaction((tx) =>
      fn({
        ...tx,
        ensureVendorProduct: async (vendorId, globalProductId) => {
          if (this.failVendorLink) {
            this.failVendorLink = false;
            throw new Error("injected failure after the global product insert");
          }
          return tx.ensureVendorProduct(vendorId, globalProductId);
        },
      }),
    );
  }
}

describe("catalog on MySQL", { skip: !host && "set CATALOG_TEST_DB_HOST to run" }, () => {
  let admin: mysql.Connection;
  let db: Database;
  let app: Awaited<ReturnType<typeof startApp>>;
  let submissionRepo: InjectableRepo;
  const media = new FakeMedia();

  const GLOBAL_CAT = randomUUID();
  const OTHER_CAT = randomUUID();
  const gp = { a: randomUUID(), b: randomUUID(), c: randomUUID(), d: randomUUID() };
  const merchantA = { userId: randomUUID(), vendorId: randomUUID() };
  const merchantB = { userId: randomUUID(), vendorId: randomUUID() };
  const VENDOR_CAT_A = randomUUID();
  const tokenA = userToken(merchantA.userId, UserRole.VENDOR);
  const tokenB = userToken(merchantB.userId, UserRole.VENDOR);
  const adminToken = userToken(randomUUID(), UserRole.ADMIN);

  const rows = async (sql: string, params: unknown[] = []) => (await admin.query<mysql.RowDataPacket[]>(sql, params))[0];

  before(async () => {
    admin = await mysql.createConnection({ ...dbConfig, multipleStatements: false });
    await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4`);
    await admin.query(`USE \`${dbName}\``);
    const schema = fs.readFileSync(path.join(__dirname, "../infrastructure/database/schema.sql"), "utf8");
    for (const stmt of schema.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await admin.query(stmt);

    await admin.query("INSERT INTO categories (id, name, type) VALUES (?, 'Grains', 'GLOBAL'), (?, 'Snacks', 'GLOBAL')", [GLOBAL_CAT, OTHER_CAT]);
    await admin.query("INSERT INTO categories (id, name, type, vendor_id) VALUES (?, 'Shelf A', 'VENDOR', ?)", [VENDOR_CAT_A, merchantA.vendorId]);
    await admin.query(
      `INSERT INTO global_products (id, name, global_category_id, measurement_type) VALUES
       (?, 'White Rice 1 kg', ?, 'UNIT'), (?, 'Brown Rice 1 kg', ?, 'UNIT'), (?, 'Lentils 500 g', ?, 'UNIT'), (?, 'Potato Chips', ?, 'UNIT')`,
      [gp.a, GLOBAL_CAT, gp.b, GLOBAL_CAT, gp.c, GLOBAL_CAT, gp.d, OTHER_CAT],
    );

    vendorsByToken.set(tokenA, { id: merchantA.vendorId, approvalStatus: "APPROVED", isActive: true });
    vendorsByToken.set(tokenB, { id: merchantB.vendorId, approvalStatus: "APPROVED", isActive: true });

    db = new Database({ ...dbConfig, database: dbName });
    const vendorProductRepo = new VendorProductRepository(db);
    const categoryRepo = new CategoryRepository(db);
    const catalogService = new CatalogService(vendorProductRepo, categoryRepo, new GlobalProductRepository(db));
    submissionRepo = new InjectableRepo(db, vendorProductRepo);
    const submissionService = new ProductSubmissionService(submissionRepo, categoryRepo, media, new FakeEvents());
    app = await startApp(
      createVendorProductRoutes(new VendorProductController(catalogService)),
      createGlobalProductRoutes(new GlobalProductController(catalogService)),
      createProductSubmissionRoutes(new ProductSubmissionController(submissionService)),
    );
  });

  after(async () => {
    await app?.close();
    await db?.close();
    await admin?.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await admin?.end();
  });

  const liveLinks = async (vendorId: string, globalProductId?: string) =>
    rows(
      `SELECT * FROM vendor_products WHERE vendor_id = ? AND deleted_at IS NULL ${globalProductId ? "AND global_product_id = ?" : ""}`,
      globalProductId ? [vendorId, globalProductId] : [vendorId],
    );

  describe("existing add-from-catalog workflows (regression)", () => {
    test("single product: a merchant adds an existing catalog product with a price", async () => {
      const res = await app.call("POST", "/products", tokenA, {
        globalProductId: gp.a,
        globalCategoryId: GLOBAL_CAT,
        vendorCategoryId: VENDOR_CAT_A,
        name: "ignored",
        price: 30,
        stockQuantity: 12,
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const list = await app.call("GET", `/products/vendor/${merchantA.vendorId}`, tokenA);
      assert.equal(list.body.data.data.length, 1);
      assert.equal(Number(list.body.data.data[0].price), 30);
      assert.equal(list.body.data.data[0].stockQuantity, 12);
    });

    test("single product: still can't create a catalog product without one", async () => {
      const res = await app.call("POST", "/products", tokenA, { globalCategoryId: GLOBAL_CAT, vendorCategoryId: VENDOR_CAT_A, name: "New thing", price: 5 });
      assert.equal(res.status, 403);
      assert.equal(res.body.message, "vendor_cannot_create_catalog_products");
    });

    test("single product: adding the same product twice is refused, not duplicated", async () => {
      const res = await app.call("POST", "/products", tokenA, { globalProductId: gp.a, globalCategoryId: GLOBAL_CAT, vendorCategoryId: VENDOR_CAT_A, price: 31 });
      assert.equal(res.status, 409);
      assert.equal(res.body.message, "vendor_product_already_exists");
      assert.equal((await liveLinks(merchantA.vendorId, gp.a)).length, 1);
    });

    test("bulk: adds new items once and skips the ones the store has", async () => {
      const res = await app.call("POST", `/products/vendor/${merchantA.vendorId}/bulk-add-global`, tokenA, {
        items: [{ globalProductId: gp.a }, { globalProductId: gp.b }, { globalProductId: gp.b }, { globalProductId: randomUUID() }],
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.added, 1);
      assert.deepEqual(res.body.data.addedProductIds, [gp.b]);
      assert.equal((await liveLinks(merchantA.vendorId)).length, 2);
    });

    test("bulk by category: adds the rest of the category, no duplicates", async () => {
      const res = await app.call("POST", `/products/vendor/${merchantA.vendorId}/bulk-add-global`, tokenA, { globalCategoryId: GLOBAL_CAT, vendorCategoryId: VENDOR_CAT_A });
      assert.equal(res.status, 201);
      assert.deepEqual(res.body.data.addedProductIds, [gp.c]);
      const links = await liveLinks(merchantA.vendorId);
      assert.equal(links.length, 3);
      assert.equal(new Set(links.map((l) => l.global_product_id)).size, 3);
    });

    test("bulk: price and stock given when adding are stored; invalid values are refused", async () => {
      const bad = [{ price: -1 }, { price: "10" }, { stockQuantity: -5 }, { stockQuantity: 1.5 }, { stockWeightGrams: -1 }];
      for (const values of bad) {
        const res = await app.call("POST", `/products/vendor/${merchantB.vendorId}/bulk-add-global`, tokenB, { items: [{ globalProductId: gp.a, ...values }] });
        assert.equal(res.status, 400, JSON.stringify(values));
      }
      assert.equal((await liveLinks(merchantB.vendorId, gp.a)).length, 0);
      const ok = await app.call("POST", `/products/vendor/${merchantB.vendorId}/bulk-add-global`, tokenB, { items: [{ globalProductId: gp.a, price: 25, stockQuantity: 8 }] });
      assert.equal(ok.status, 201);
      const [row] = await liveLinks(merchantB.vendorId, gp.a);
      assert.equal(Number(row.price), 25);
      assert.equal(row.stock_quantity, 8);
      assert.equal(row.is_available, 1);
    });

    test("bulk: stock without a price is never sellable", async () => {
      const res = await app.call("POST", `/products/vendor/${merchantB.vendorId}/bulk-add-global`, tokenB, { items: [{ globalProductId: gp.b, stockQuantity: 8 }] });
      assert.equal(res.status, 201);
      const [row] = await liveLinks(merchantB.vendorId, gp.b);
      assert.equal(row.is_available, 0);
    });

    test("bulk: only into the merchant's own store", async () => {
      const res = await app.call("POST", `/products/vendor/${merchantB.vendorId}/bulk-add-global`, tokenA, { items: [{ globalProductId: gp.d }] });
      assert.equal(res.status, 403);
      assert.equal(res.body.message, "vendor_id_mismatch");
    });

    test("bulk: concurrent adds of the same product leave one row", async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => app.call("POST", `/products/vendor/${merchantB.vendorId}/bulk-add-global`, tokenB, { items: [{ globalProductId: gp.d }] })),
      );
      assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.body)));
      assert.equal((await liveLinks(merchantB.vendorId, gp.d)).length, 1);
    });
  });

  describe("product proposals", () => {
    const propose = async (token: string, userId: string, name: string, extra: Record<string, unknown> = {}) => {
      const imageKey = imageKeyFor(userId);
      media.addPrivate(imageKey);
      return app.call("POST", "/product-submissions", token, { name, globalCategoryId: GLOBAL_CAT, measurementType: MeasurementType.UNIT, imageKey, ...extra });
    };

    test("pending proposals are not in the public catalog or any store", async () => {
      const res = await propose(tokenA, merchantA.userId, "Freekeh 500 g");
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const catalog = await app.call("GET", "/global-products?search=Freekeh", tokenB);
      assert.equal(catalog.body.data.total, 0);
      const search = await app.call("GET", "/products/search?search=Freekeh", tokenB);
      assert.equal(search.body.data.total, 0);
      assert.equal((await rows("SELECT * FROM global_products WHERE name LIKE '%Freekeh%'")).length, 0);
      // Another merchant can't open it
      assert.equal((await app.call("GET", `/product-submissions/${res.body.data.id}`, tokenB)).status, 404);
    });

    test("the database keeps one open proposal per store and name", async () => {
      const first = await propose(tokenA, merchantA.userId, "Bulgur Fine 1 kg");
      assert.equal(first.status, 201);
      const second = await propose(tokenA, merchantA.userId, "bulgur fine 1kg");
      assert.equal(second.status, 409);
      assert.equal(second.body.message, "duplicate_open_submission");
    });

    test("approval publishes one global product and one store product; price and stock stay vendor-specific", async () => {
      const created = await propose(tokenA, merchantA.userId, "Sorghum Flour 1 kg");
      const id = created.body.data.id;

      const results = await Promise.all(Array.from({ length: 5 }, () => app.call("POST", `/admin/product-submissions/${id}/approve`, adminToken, { revision: 1 })));
      assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.body)));
      assert.equal(results.filter((r) => !r.body.data.alreadyApplied).length, 1);

      const products = await rows("SELECT * FROM global_products WHERE name = 'Sorghum Flour 1 kg'");
      assert.equal(products.length, 1);
      const product = products[0];
      assert.equal(product.global_category_id, GLOBAL_CAT);
      assert.match(product.image_url, new RegExp(`/globals/${product.id}/large\\.webp$`));
      assert.equal("price" in product, false, "global_products has no price");

      const links = await liveLinks(merchantA.vendorId, product.id);
      assert.equal(links.length, 1);
      assert.equal(Number(links[0].price), 0);
      assert.equal(links[0].stock_quantity, 0);
      assert.equal(links[0].is_available, 0);
      assert.equal((await liveLinks(merchantB.vendorId, product.id)).length, 0);

      const submission = (await rows("SELECT * FROM product_submissions WHERE id = ?", [id]))[0];
      assert.equal(submission.status, "APPROVED");
      assert.equal(submission.global_product_id, product.id);
      assert.equal(submission.vendor_product_id, links[0].id);
      const history = await rows("SELECT action FROM product_submission_history WHERE submission_id = ? ORDER BY created_at", [id]);
      assert.deepEqual(history.map((h) => h.action), ["SUBMITTED", "APPROVED"]);

      // The merchant then uses the existing price / stock workflow
      assert.equal((await app.call("PATCH", `/products/${links[0].id}/price`, tokenA, { price: 55 })).status, 200);
      assert.equal((await app.call("PATCH", `/products/${links[0].id}/stock`, tokenA, { stock: 20 })).status, 200);
      const updated = (await liveLinks(merchantA.vendorId, product.id))[0];
      assert.equal(Number(updated.price), 55);
      assert.equal(updated.stock_quantity, 20);
      // Another merchant can't
      assert.equal((await app.call("PATCH", `/products/${links[0].id}/price`, tokenB, { price: 1 })).status, 403);
      // Now public
      const catalog = await app.call("GET", "/global-products?search=Sorghum", tokenB);
      assert.equal(catalog.body.data.total, 1);
    });

    test("a database failure mid-approval leaves nothing behind; the retry succeeds", async () => {
      const created = await propose(tokenA, merchantA.userId, "Millet Grain 500 g");
      const id = created.body.data.id;
      submissionRepo.failVendorLink = true;
      const failed = await app.call("POST", `/admin/product-submissions/${id}/approve`, adminToken, { revision: 1 });
      assert.equal(failed.status, 500);
      assert.equal((await rows("SELECT * FROM global_products WHERE name = 'Millet Grain 500 g'")).length, 0, "global product insert rolled back");
      const pending = (await rows("SELECT * FROM product_submissions WHERE id = ?", [id]))[0];
      assert.equal(pending.status, "PENDING_REVIEW");
      assert.ok(pending.reserved_global_product_id);

      const retry = await app.call("POST", `/admin/product-submissions/${id}/approve`, adminToken, { revision: 1 });
      assert.equal(retry.status, 200, JSON.stringify(retry.body));
      assert.equal(retry.body.data.submission.globalProductId, pending.reserved_global_product_id);
      assert.equal((await rows("SELECT * FROM global_products WHERE name = 'Millet Grain 500 g'")).length, 1);
    });

    test("linking to a product the store already sells reuses that row", async () => {
      const created = await propose(tokenA, merchantA.userId, "White Rice 1kg Premium", { acknowledgedDuplicates: true });
      const before = await liveLinks(merchantA.vendorId, gp.a);
      const res = await app.call("POST", `/admin/product-submissions/${created.body.data.id}/link`, adminToken, { revision: 1, globalProductId: gp.a });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.submission.vendorProductId, before[0].id);
      const afterLinks = await liveLinks(merchantA.vendorId, gp.a);
      assert.equal(afterLinks.length, 1);
      assert.equal(Number(afterLinks[0].price), 30, "the store's price is untouched");
    });

    test("an existing catalog product can't be proposed", async () => {
      const res = await propose(tokenA, merchantA.userId, "lentils 500G", { acknowledgedDuplicates: true });
      assert.equal(res.status, 409);
      assert.equal(res.body.message, "product_already_in_catalog");
      assert.equal(res.body.errors.matches[0].globalProductId, gp.c);
    });

    test("the merchant's duplicate check finds catalog products", async () => {
      const res = await app.call("POST", "/product-submissions/check-duplicates", tokenA, { name: "white rice 1KG", globalCategoryId: GLOBAL_CAT });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.matches[0].globalProductId, gp.a);
      assert.equal(res.body.data.matches[0].exact, true);
    });

    test("approval re-checks exact duplicates under lock", async () => {
      const created = await propose(tokenA, merchantA.userId, "Chickpeas 1 kg");
      await admin.query("INSERT INTO global_products (id, name, global_category_id) VALUES (?, 'chickpeas 1kg', ?)", [randomUUID(), GLOBAL_CAT]);
      const res = await app.call("POST", `/admin/product-submissions/${created.body.data.id}/approve`, adminToken, { revision: 1 });
      assert.equal(res.status, 409);
      assert.equal(res.body.message, "duplicate_exists");
      assert.equal((await rows("SELECT * FROM global_products WHERE name LIKE 'chickpeas%'")).length, 1);
    });

    test("admin queue lists by status", async () => {
      const res = await app.call("GET", "/admin/product-submissions?status=PENDING_REVIEW&limit=50", adminToken);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.data.length >= 1);
      assert.ok(res.body.data.data.every((s: any) => s.status === "PENDING_REVIEW"));
      const bad = await app.call("GET", "/admin/product-submissions?status=WHATEVER", adminToken);
      assert.equal(bad.status, 400);
    });
  });
});
