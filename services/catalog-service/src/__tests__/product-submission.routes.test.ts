import { vendorsByToken, startApp, userToken, serviceToken } from "./helpers/http";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { MeasurementType, UserRole } from "@city-market/shared";
import { ProductSubmissionService } from "../application/services/product-submission.service";
import { ProductSubmissionController } from "../presentation/controllers/product-submission.controller";
import { createProductSubmissionRoutes } from "../presentation/routes/product-submission.routes";
import { FakeCategoryRepository, FakeEvents, FakeMedia, FakeSubmissionRepository, imageKeyFor } from "./helpers/fakes";

// HTTP-level authorization: real JWT authentication, real routes and controller, in-memory data
const CATEGORY = randomUUID();
const repo = new FakeSubmissionRepository();
const media = new FakeMedia();
repo.addCategory(CATEGORY, "Grains");
const service = new ProductSubmissionService(repo, new FakeCategoryRepository(repo) as any, media, new FakeEvents());

const merchantA = { userId: randomUUID(), vendorId: randomUUID() };
const merchantB = { userId: randomUUID(), vendorId: randomUUID() };
const pendingMerchant = { userId: randomUUID(), vendorId: randomUUID() };
const tokenA = userToken(merchantA.userId, UserRole.VENDOR);
const tokenB = userToken(merchantB.userId, UserRole.VENDOR);
const tokenPending = userToken(pendingMerchant.userId, UserRole.VENDOR);
const adminId = randomUUID();
const adminToken = userToken(adminId, UserRole.ADMIN);
const customerToken = userToken(randomUUID(), UserRole.CUSTOMER);
vendorsByToken.set(tokenA, { id: merchantA.vendorId, approvalStatus: "APPROVED", isActive: true });
vendorsByToken.set(tokenB, { id: merchantB.vendorId, approvalStatus: "APPROVED", isActive: true });
vendorsByToken.set(tokenPending, { id: pendingMerchant.vendorId, approvalStatus: "PENDING_REVIEW", isActive: true });

let app: Awaited<ReturnType<typeof startApp>>;
before(async () => {
  app = await startApp(createProductSubmissionRoutes(new ProductSubmissionController(service)));
});
after(() => app.close());

const body = (userId: string, overrides: Record<string, unknown> = {}) => {
  const imageKey = imageKeyFor(userId);
  media.addPrivate(imageKey);
  return { name: `Product ${randomUUID().slice(0, 8)}`, globalCategoryId: CATEGORY, measurementType: MeasurementType.UNIT, imageKey, ...overrides };
};

describe("product submission routes", () => {
  let submissionId: string;
  beforeEach(async () => {
    const res = await app.call("POST", "/product-submissions", tokenA, body(merchantA.userId));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    submissionId = res.body.data.id;
  });

  test("requires authentication", async () => {
    assert.equal((await app.call("GET", "/product-submissions/mine")).status, 401);
    assert.equal((await app.call("POST", "/product-submissions", undefined, body(merchantA.userId))).status, 401);
    assert.equal((await app.call("GET", "/admin/product-submissions")).status, 401);
  });

  test("customers can't propose or review", async () => {
    assert.equal((await app.call("POST", "/product-submissions", customerToken, body(merchantA.userId))).status, 401);
    assert.equal((await app.call("POST", `/admin/product-submissions/${submissionId}/approve`, customerToken, { revision: 1 })).status, 401);
  });

  test("merchants can't use any review endpoint", async () => {
    for (const path of ["approve", "link", "reject", "request-changes"]) {
      const res = await app.call("POST", `/admin/product-submissions/${submissionId}/${path}`, tokenA, { revision: 1, reason: "x", feedback: "x" });
      assert.equal(res.status, 401, path);
    }
    assert.equal((await app.call("GET", "/admin/product-submissions", tokenA)).status, 401);
    assert.equal((await app.call("GET", `/admin/product-submissions/${submissionId}`, tokenA)).status, 401);
    assert.equal(repo.state.submissions.get(submissionId)!.status, "PENDING_REVIEW");
  });

  test("a merchant can't approve their own proposal by sending a status", async () => {
    const res = await app.call("PUT", `/product-submissions/${submissionId}`, tokenA, {
      ...body(merchantA.userId),
      status: "APPROVED",
      reviewedBy: merchantA.userId,
      globalProductId: randomUUID(),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "PENDING_REVIEW");
    assert.equal(res.body.data.globalProductId, null);
  });

  test("merchants only see their own proposals", async () => {
    assert.equal((await app.call("GET", `/product-submissions/${submissionId}`, tokenB)).status, 404);
    assert.equal((await app.call("PUT", `/product-submissions/${submissionId}`, tokenB, body(merchantB.userId))).status, 404);
    assert.equal((await app.call("POST", `/product-submissions/${submissionId}/cancel`, tokenB)).status, 404);
    const mine = await app.call("GET", "/product-submissions/mine", tokenB);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.data.every((s: any) => s.vendorId === merchantB.vendorId));
    const own = await app.call("GET", `/product-submissions/${submissionId}`, tokenA);
    assert.equal(own.status, 200);
    // No internal review data for merchants
    assert.equal(own.body.data.submittedByUserId, undefined);
    assert.equal(own.body.data.history[0].actorUserId, undefined);
  });

  test("a merchant can't attach another merchant's uploaded photo", async () => {
    const res = await app.call("POST", "/product-submissions", tokenB, body(merchantB.userId, { imageKey: repo.state.submissions.get(submissionId)!.imageKey }));
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "submission_image_invalid");
  });

  test("merchants waiting for store approval can't propose", async () => {
    const res = await app.call("POST", "/product-submissions", tokenPending, body(pendingMerchant.userId));
    assert.equal(res.status, 403);
    assert.equal(res.body.message, "vendor_not_approved");
  });

  test("admins and services review, but don't propose", async () => {
    // The shared authorize() answers 401 for a role that isn't allowed
    const res = await app.call("POST", "/product-submissions", adminToken, body(adminId));
    assert.equal(res.status, 401);
    // Service tokens pass authorize(); the controller still requires a merchant
    const svc = await app.call("POST", "/product-submissions", serviceToken(), body(adminId));
    assert.equal(svc.status, 403);
    assert.equal(svc.body.message, "vendor_only");
  });

  test("admin-service forwards the reviewer; without it the decision is refused", async () => {
    const missing = await app.call("POST", `/admin/product-submissions/${submissionId}/reject`, serviceToken(), { revision: 1, reason: "Blurry photo" });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.message, "reviewer_required");
    const ok = await app.call("POST", `/admin/product-submissions/${submissionId}/reject`, serviceToken(), { revision: 1, reason: "Blurry photo" }, { "X-User-Id": adminId });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.submission.status, "REJECTED");
    assert.equal(ok.body.data.submission.reviewedBy, adminId);
  });

  test("admin approval over HTTP, and a repeat is reported as already applied", async () => {
    const first = await app.call("POST", `/admin/product-submissions/${submissionId}/approve`, adminToken, { revision: 1 });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.data.submission.status, "APPROVED");
    const second = await app.call("POST", `/admin/product-submissions/${submissionId}/approve`, adminToken, { revision: 1 });
    assert.equal(second.status, 200);
    assert.equal(second.body.data.alreadyApplied, true);
  });

  test("an existing catalog product is refused with 409 and the match; confirming doesn't bypass it", async () => {
    repo.addGlobalProduct({ id: randomUUID(), name: "Basmati Rice 5 kg", globalCategoryId: CATEGORY });
    for (const acknowledgedDuplicates of [false, true]) {
      const res = await app.call("POST", "/product-submissions", tokenA, body(merchantA.userId, { name: "basmati rice 5kg", acknowledgedDuplicates }));
      assert.equal(res.status, 409);
      assert.equal(res.body.message, "product_already_in_catalog");
      assert.equal(res.body.errors.matches[0].name, "Basmati Rice 5 kg");
    }
    const close = await app.call("POST", "/product-submissions", tokenA, body(merchantA.userId, { name: "basmati rice premium 5kg" }));
    assert.equal(close.status, 409);
    assert.equal(close.body.message, "possible_duplicates");
  });

  test("admin detail includes the signed photo URL, duplicates and full history", async () => {
    const res = await app.call("GET", `/admin/product-submissions/${submissionId}`, adminToken);
    assert.equal(res.status, 200);
    assert.match(res.body.data.submission.imageUrl, /^https:\/\/signed\.example\//);
    assert.ok(Array.isArray(res.body.data.duplicates));
    assert.equal(res.body.data.submission.history[0].actorUserId, merchantA.userId);
  });
});
