import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { AppError, CategoryType, EventType, MeasurementType, ProductSubmissionStatus, WeightUnit } from "@city-market/shared";
import { DuplicateConflictError, ProductSubmissionService, VendorActor } from "../application/services/product-submission.service";
import { FakeCategoryRepository, FakeEvents, FakeMedia, FakeSubmissionRepository, imageKeyFor } from "./helpers/fakes";

const CATEGORY = randomUUID();
const OTHER_CATEGORY = randomUUID();
const ADMIN = { userId: randomUUID(), role: "ADMIN" };

let repo: FakeSubmissionRepository;
let media: FakeMedia;
let events: FakeEvents;
let service: ProductSubmissionService;
let vendorA: VendorActor;
let vendorB: VendorActor;

const rejects = async (promise: Promise<unknown>, status: number, message: string) => {
  await assert.rejects(promise, (error: any) => {
    assert.ok(error instanceof AppError, `expected AppError, got ${error}`);
    assert.equal(error.message, message);
    assert.equal(error.statusCode, status);
    return true;
  });
};

const uploadFor = (actor: VendorActor) => {
  const key = imageKeyFor(actor.userId);
  media.addPrivate(key);
  return key;
};

const input = (actor: VendorActor, overrides: Record<string, unknown> = {}) => ({
  name: "Organic Quinoa 500 g",
  description: "Whole grain",
  globalCategoryId: CATEGORY,
  measurementType: MeasurementType.UNIT,
  imageKey: uploadFor(actor),
  ...overrides,
});

beforeEach(() => {
  repo = new FakeSubmissionRepository();
  repo.addCategory(CATEGORY, "Grains");
  repo.addCategory(OTHER_CATEGORY, "Snacks");
  media = new FakeMedia();
  events = new FakeEvents();
  service = new ProductSubmissionService(repo, new FakeCategoryRepository(repo) as any, media, events);
  vendorA = { userId: randomUUID(), vendorId: randomUUID() };
  vendorB = { userId: randomUUID(), vendorId: randomUUID() };
});

describe("submission", () => {
  test("creates a pending proposal without creating a catalog or store product", async () => {
    const s = await service.create(vendorA, input(vendorA));
    assert.equal(s.status, ProductSubmissionStatus.PENDING_REVIEW);
    assert.equal(s.revision, 1);
    assert.equal(s.vendorId, vendorA.vendorId);
    assert.equal(s.imageWidth, 1200);
    assert.match(s.imageUrl ?? "", /^https:\/\/signed\.example\//);
    assert.equal(s.history?.length, 1);
    assert.equal(s.history?.[0].action, "SUBMITTED");
    // Not public, not sellable
    assert.equal(repo.state.globalProducts.size, 0);
    assert.equal(repo.state.vendorProducts.length, 0);
    assert.equal(media.publicFolders.size, 0);
    // Vendors don't see internal review data
    assert.equal(s.submittedByUserId, undefined);
    assert.equal(s.history?.[0].actorUserId, undefined);
  });

  test("ignores privileged fields in the request (mass assignment)", async () => {
    const s = await service.create(vendorA, {
      ...input(vendorA),
      status: "APPROVED",
      vendorId: vendorB.vendorId,
      reviewedBy: ADMIN.userId,
      globalProductId: randomUUID(),
      resolution: "CREATED",
      revision: 99,
      price: 10,
      stockQuantity: 5,
    });
    assert.equal(s.status, ProductSubmissionStatus.PENDING_REVIEW);
    assert.equal(s.vendorId, vendorA.vendorId);
    assert.equal(s.globalProductId, null);
    assert.equal(s.revision, 1);
    const stored = repo.state.submissions.get(s.id)! as any;
    assert.equal(stored.price, undefined);
    assert.equal(stored.stockQuantity, undefined);
  });

  test("validates fields", async () => {
    await rejects(service.create(vendorA, input(vendorA, { name: " " })), 400, "submission_name_required");
    await rejects(service.create(vendorA, input(vendorA, { name: "x".repeat(256) })), 400, "submission_name_too_long");
    await rejects(service.create(vendorA, input(vendorA, { description: "x".repeat(2001) })), 400, "submission_description_too_long");
    await rejects(service.create(vendorA, input(vendorA, { measurementType: "BOX" })), 400, "invalid_measurement_type");
    await rejects(service.create(vendorA, input(vendorA, { measurementType: MeasurementType.WEIGHT })), 400, "invalid_weight_unit");
    await rejects(service.create(vendorA, input(vendorA, { imageKey: "" })), 400, "submission_image_required");
    await rejects(service.create(vendorA, input(vendorA, { globalCategoryId: randomUUID() })), 400, "invalid_global_category");
    const vendorCategory = randomUUID();
    repo.addCategory(vendorCategory, "My shelf", CategoryType.VENDOR);
    await rejects(service.create(vendorA, input(vendorA, { globalCategoryId: vendorCategory })), 400, "invalid_global_category");
  });

  test("weight unit is kept only for weight products", async () => {
    const byUnit = await service.create(vendorA, input(vendorA, { weightUnit: WeightUnit.KG }));
    assert.equal(byUnit.weightUnit, null);
    const byWeight = await service.create(vendorA, input(vendorA, { name: "Basmati rice", measurementType: MeasurementType.WEIGHT, weightUnit: WeightUnit.KG }));
    assert.equal(byWeight.weightUnit, WeightUnit.KG);
  });

  test("only accepts the merchant's own uploaded photo", async () => {
    const othersKey = uploadFor(vendorB);
    await rejects(service.create(vendorA, input(vendorA, { imageKey: othersKey })), 400, "submission_image_invalid");
    await rejects(service.create(vendorA, input(vendorA, { imageKey: "globals/abc/large.webp" })), 400, "submission_image_invalid");
    await rejects(service.create(vendorA, input(vendorA, { imageKey: `product-submissions/${vendorA.userId}/../x.webp` })), 400, "submission_image_invalid");
    // Right owner, but never uploaded
    await rejects(service.create(vendorA, input(vendorA, { imageKey: imageKeyFor(vendorA.userId) })), 400, "submission_image_missing");
  });

  test("a photo can back only one proposal", async () => {
    const key = uploadFor(vendorA);
    await service.create(vendorA, input(vendorA, { imageKey: key }));
    await rejects(service.create(vendorA, input(vendorA, { name: "Other product", imageKey: key })), 409, "submission_image_already_used");
  });

  test("one open proposal per store, name and category", async () => {
    await service.create(vendorA, input(vendorA));
    await rejects(service.create(vendorA, input(vendorA, { name: "organic  QUINOA 500g" })), 409, "duplicate_open_submission");
    // Another store may propose the same product
    await service.create(vendorB, input(vendorB));
  });
});

describe("duplicate detection", () => {
  beforeEach(() => {
    repo.addGlobalProduct({ id: randomUUID(), name: "Organic Quinoa 500g", globalCategoryId: CATEGORY });
    repo.addGlobalProduct({ id: randomUUID(), name: "الأرز المصري ١ كيلو", globalCategoryId: CATEGORY });
    repo.addGlobalProduct({ id: randomUUID(), name: "Quinoa Chips", globalCategoryId: OTHER_CATEGORY });
  });

  test("lists likely catalog matches before submitting", async () => {
    const matches = await service.checkDuplicates({ name: "organic quinoa 500 G", globalCategoryId: CATEGORY });
    assert.equal(matches[0].name, "Organic Quinoa 500g");
    assert.equal(matches[0].exact, true);
    assert.equal(matches[0].sameCategory, true);
  });

  test("matches Arabic spelling variants and digits", async () => {
    const matches = await service.checkDuplicates({ name: "ارز مصري 1 كيلو", globalCategoryId: CATEGORY });
    assert.equal(matches[0]?.name, "الأرز المصري ١ كيلو");
    assert.equal(matches[0].exact, true);
  });

  test("does not treat a different size as the same product", async () => {
    const matches = await service.checkDuplicates({ name: "Organic Quinoa 1 kg", globalCategoryId: CATEGORY });
    assert.ok(matches.every((m) => !m.exact));
    // Different variant: allowed without confirmation
    const s = await service.create(vendorA, input(vendorA, { name: "Organic Quinoa 1 kg" }));
    assert.equal(s.status, ProductSubmissionStatus.PENDING_REVIEW);
  });

  test("refuses a product the catalog already has (same name and category), even when confirmed", async () => {
    for (const acknowledgedDuplicates of [false, true]) {
      await assert.rejects(service.create(vendorA, input(vendorA, { acknowledgedDuplicates })), (error: any) => {
        assert.ok(error instanceof DuplicateConflictError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.message, "product_already_in_catalog");
        assert.equal(error.matches.length, 1);
        assert.equal(error.matches[0].name, "Organic Quinoa 500g");
        return true;
      });
    }
    assert.equal(repo.state.submissions.size, 0);
    // The same name in another category is a warning, not a block
    const s = await service.create(vendorA, input(vendorA, { globalCategoryId: OTHER_CATEGORY, acknowledgedDuplicates: true }));
    assert.equal(s.status, ProductSubmissionStatus.PENDING_REVIEW);
  });

  test("an edit can't turn a proposal into an existing product either", async () => {
    const s = await service.create(vendorA, input(vendorA, { name: "Red Quinoa 500 g" }));
    await rejects(service.update(vendorA, s.id, input(vendorA, { name: "organic quinoa 500G", acknowledgedDuplicates: true })), 409, "product_already_in_catalog");
  });

  test("asks the merchant to confirm when a close (not identical) product exists", async () => {
    const close = input(vendorA, { name: "Organic Quinoa Grain 500 g" });
    await assert.rejects(service.create(vendorA, close), (error: any) => {
      assert.ok(error instanceof DuplicateConflictError);
      assert.equal(error.message, "possible_duplicates");
      assert.equal(error.matches[0].name, "Organic Quinoa 500g");
      return true;
    });
    assert.equal(repo.state.submissions.size, 0);
    const s = await service.create(vendorA, { ...close, acknowledgedDuplicates: true });
    assert.equal(s.vendorAcknowledgedDuplicates, true);
  });

  test("search finds catalog products from part of the name", async () => {
    const matches = await service.checkDuplicates({ name: "quin" });
    assert.deepEqual(matches.map((m) => m.name).sort(), ["Organic Quinoa 500g", "Quinoa Chips"]);
    const arabic = await service.checkDuplicates({ name: "ارز" });
    assert.equal(arabic[0]?.name, "الأرز المصري ١ كيلو");
  });

  test("shows admins catalog duplicates and similar open proposals", async () => {
    const s = await service.create(vendorA, input(vendorA, { name: "Organic Quinoa Grain 500 g", acknowledgedDuplicates: true }));
    await service.create(vendorB, input(vendorB, { name: "Organic Quinoa Grain 500 g", acknowledgedDuplicates: true }));
    const detail = await service.getForAdmin(s.id);
    assert.equal(detail.duplicates[0].name, "Organic Quinoa 500g");
    assert.equal(detail.similarPending.length, 1);
    assert.equal(detail.similarPending[0].vendorId, vendorB.vendorId);
  });
});

describe("ownership", () => {
  test("a merchant can't read, edit or withdraw another store's proposal", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await rejects(service.getForVendor(vendorB, s.id), 404, "submission_not_found");
    await rejects(service.update(vendorB, s.id, input(vendorB)), 404, "submission_not_found");
    await rejects(service.cancel(vendorB, s.id), 404, "submission_not_found");
    const list = await service.listForVendor(vendorB, {});
    assert.equal(list.total, 0);
    assert.equal(repo.state.submissions.get(s.id)!.status, ProductSubmissionStatus.PENDING_REVIEW);
  });
});

describe("editing and withdrawing", () => {
  test("editing a pending proposal bumps the revision and replaces the photo", async () => {
    const s = await service.create(vendorA, input(vendorA));
    const oldKey = repo.state.submissions.get(s.id)!.imageKey;
    const updated = await service.update(vendorA, s.id, input(vendorA, { name: "Organic Quinoa 750 g" }));
    assert.equal(updated.status, ProductSubmissionStatus.PENDING_REVIEW);
    assert.equal(updated.revision, 2);
    assert.equal(updated.name, "Organic Quinoa 750 g");
    assert.equal(media.privateObjects.has(oldKey), false, "replaced photo is deleted");
    assert.equal(updated.history?.at(-1)?.action, "UPDATED");
  });

  test("an edit without a photo key keeps the current photo", async () => {
    const s = await service.create(vendorA, input(vendorA));
    const key = repo.state.submissions.get(s.id)!.imageKey;
    const { imageKey: _omit, ...withoutImage } = input(vendorA, { name: "Organic Quinoa 1 kg" });
    const updated = await service.update(vendorA, s.id, withoutImage);
    assert.equal(updated.revision, 2);
    assert.equal(repo.state.submissions.get(s.id)!.imageKey, key);
    assert.ok(media.privateObjects.has(key), "kept photo is not deleted");
    // Creating still requires one
    await rejects(service.create(vendorA, withoutImage), 400, "submission_image_required");
  });

  test("changes requested -> merchant resubmits -> pending again", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await service.requestChanges(ADMIN, s.id, { revision: 1, feedback: "Use a photo without the price sticker" });
    const needsChanges = await service.getForVendor(vendorA, s.id);
    assert.equal(needsChanges.status, ProductSubmissionStatus.NEEDS_CHANGES);
    assert.equal(needsChanges.reviewNote, "Use a photo without the price sticker");

    const resubmitted = await service.update(vendorA, s.id, input(vendorA));
    assert.equal(resubmitted.status, ProductSubmissionStatus.PENDING_REVIEW);
    assert.equal(resubmitted.revision, 2);
    assert.deepEqual(
      resubmitted.history?.map((h) => h.action),
      ["SUBMITTED", "CHANGES_REQUESTED", "RESUBMITTED"],
    );
    assert.equal(events.events.length, 1);
    assert.equal(events.events[0].payload.status, "NEEDS_CHANGES");
  });

  test("final proposals can't be edited or withdrawn", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await service.reject(ADMIN, s.id, { revision: 1, reason: "Not a grocery item" });
    await rejects(service.update(vendorA, s.id, input(vendorA)), 409, "submission_not_editable");
    await rejects(service.cancel(vendorA, s.id), 409, "submission_not_editable");
  });

  test("withdrawing deletes the private photo and is repeatable", async () => {
    const s = await service.create(vendorA, input(vendorA));
    const key = repo.state.submissions.get(s.id)!.imageKey;
    const cancelled = await service.cancel(vendorA, s.id);
    assert.equal(cancelled.status, ProductSubmissionStatus.CANCELLED);
    assert.equal(media.privateObjects.has(key), false);
    const again = await service.cancel(vendorA, s.id);
    assert.equal(again.status, ProductSubmissionStatus.CANCELLED);
    await rejects(service.approve(ADMIN, s.id, { revision: 1 }), 409, "submission_not_reviewable");
  });
});

describe("admin approval", () => {
  test("creates the global product and the store's vendor product (price/stock stay on the vendor product)", async () => {
    const s = await service.create(vendorA, input(vendorA, { measurementType: MeasurementType.WEIGHT, weightUnit: WeightUnit.GRAM }));
    const privateKey = repo.state.submissions.get(s.id)!.imageKey;
    const { submission, alreadyApplied } = await service.approve(ADMIN, s.id, { revision: 1, note: "Welcome" });

    assert.equal(alreadyApplied, undefined);
    assert.equal(submission.status, ProductSubmissionStatus.APPROVED);
    assert.equal(submission.resolution, "CREATED");
    assert.equal(submission.reviewedBy, ADMIN.userId);
    const gp = repo.state.globalProducts.get(submission.globalProductId!)! as any;
    assert.equal(gp.name, "Organic Quinoa 500 g");
    assert.equal(gp.globalCategoryId, CATEGORY);
    assert.equal(gp.measurementType, MeasurementType.WEIGHT);
    assert.equal(gp.weightUnit, WeightUnit.GRAM);
    assert.equal(gp.imageUrl, `https://cdn.example/globals/${gp.id}/large.webp`);
    assert.equal(gp.price, undefined, "no price on the global product");
    assert.equal(gp.stockQuantity, undefined, "no stock on the global product");

    const links = repo.liveVendorProducts(vendorA.vendorId);
    assert.equal(links.length, 1);
    assert.equal(links[0].globalProductId, gp.id);
    assert.equal(links[0].id, submission.vendorProductId);
    // Merchant sets price and stock afterwards; not sellable until then
    assert.equal(links[0].price, 0);
    assert.equal(links[0].stockQuantity, 0);
    assert.equal(links[0].isAvailable, false);
    assert.equal(repo.liveVendorProducts(vendorB.vendorId).length, 0);

    assert.equal(media.privateObjects.has(privateKey), false, "private photo removed after publishing");
    assert.equal(submission.imageUrl, gp.imageUrl, "approved proposals show the published image");
    assert.equal(events.events.length, 1);
    assert.equal(events.events[0].type, EventType.PRODUCT_SUBMISSION_REVIEWED);
    assert.equal(events.events[0].payload.vendorUserId, vendorA.userId);
    assert.equal(events.events[0].payload.status, "APPROVED");
  });

  test("repeating the approval changes nothing and notifies once", async () => {
    const s = await service.create(vendorA, input(vendorA));
    const first = await service.approve(ADMIN, s.id, { revision: 1 });
    const second = await service.approve(ADMIN, s.id, { revision: 1 });
    assert.equal(second.alreadyApplied, true);
    assert.equal(second.submission.globalProductId, first.submission.globalProductId);
    assert.equal(repo.state.globalProducts.size, 1);
    assert.equal(repo.liveVendorProducts(vendorA.vendorId).length, 1);
    assert.equal(events.events.length, 1);
  });

  test("concurrent approvals create exactly one product and one store link", async () => {
    const s = await service.create(vendorA, input(vendorA));
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.approve(ADMIN, s.id, { revision: 1 })));
    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    assert.equal(fulfilled.length, 5, JSON.stringify(results.filter((r) => r.status === "rejected")));
    assert.equal(fulfilled.filter((r) => !r.value.alreadyApplied).length, 1);
    assert.equal(new Set(fulfilled.map((r) => r.value.submission.globalProductId)).size, 1);
    assert.equal(repo.state.globalProducts.size, 1);
    assert.equal(repo.liveVendorProducts(vendorA.vendorId).length, 1);
    assert.equal(events.events.length, 1);
    // Every attempt published under the same reserved id
    assert.equal(media.publicFolders.size, 1);
  });

  test("image promotion failure changes nothing visible; a retry succeeds with the same id", async () => {
    const s = await service.create(vendorA, input(vendorA));
    media.failPromote = new Error("R2 timeout");
    await rejects(service.approve(ADMIN, s.id, { revision: 1 }), 502, "image_promotion_failed");
    const after = repo.state.submissions.get(s.id)!;
    assert.equal(after.status, ProductSubmissionStatus.PENDING_REVIEW);
    assert.equal(repo.state.globalProducts.size, 0);
    assert.equal(repo.state.vendorProducts.length, 0);
    assert.equal(events.events.length, 0);
    const reservedId = after.reservedGlobalProductId;
    assert.ok(reservedId);

    const { submission } = await service.approve(ADMIN, s.id, { revision: 1 });
    assert.equal(submission.globalProductId, reservedId);
  });

  test("a database failure during approval rolls everything back; a retry succeeds", async () => {
    const s = await service.create(vendorA, input(vendorA));
    repo.failOn.ensureVendorProduct = new Error("connection lost");
    await assert.rejects(service.approve(ADMIN, s.id, { revision: 1 }), /connection lost/);
    assert.equal(repo.state.submissions.get(s.id)!.status, ProductSubmissionStatus.PENDING_REVIEW);
    assert.equal(repo.state.globalProducts.size, 0, "global product insert rolled back");
    assert.equal(repo.state.vendorProducts.length, 0);
    assert.equal(events.events.length, 0);
    assert.equal(media.privateObjects.size, 1, "private photo kept for the retry");

    const { submission } = await service.approve(ADMIN, s.id, { revision: 1 });
    assert.equal(submission.status, ProductSubmissionStatus.APPROVED);
    assert.equal(repo.state.globalProducts.size, 1);
  });

  test("a failed private-photo delete after commit doesn't undo the approval", async () => {
    const s = await service.create(vendorA, input(vendorA));
    media.failDeletePrivate = true;
    const { submission } = await service.approve(ADMIN, s.id, { revision: 1 });
    assert.equal(submission.status, ProductSubmissionStatus.APPROVED);
    // Left for the orphan cleanup, which removes it once the delete works again
    assert.equal(media.privateObjects.size, 1);
    media.failDeletePrivate = false;
    const result = await service.cleanupOrphanImages();
    assert.deepEqual(result, { checked: 1, deleted: 1 });
  });

  test("refuses to approve a version the admin didn't review", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await service.update(vendorA, s.id, input(vendorA, { name: "Something else entirely" }));
    await rejects(service.approve(ADMIN, s.id, { revision: 1 }), 409, "submission_changed_reload");
    await rejects(service.approve(ADMIN, s.id, {}), 400, "revision_required");
    assert.equal(repo.state.globalProducts.size, 0);
  });

  test("a merchant edit during approval aborts the approval", async () => {
    const s = await service.create(vendorA, input(vendorA));
    const nextInput = input(vendorA, { name: "Changed while reviewing" });
    // Edit lands between the reservation and the final commit (while the photo is copied)
    const approving = service.approve(ADMIN, s.id, { revision: 1 });
    const editing = service.update(vendorA, s.id, nextInput);
    const [approval, edit] = await Promise.allSettled([approving, editing]);
    assert.equal(edit.status, "fulfilled");
    assert.equal(approval.status, "rejected");
    assert.equal((approval as PromiseRejectedResult).reason.message, "submission_changed_reload");
    assert.equal(repo.state.globalProducts.size, 0);
    assert.equal(repo.state.submissions.get(s.id)!.status, ProductSubmissionStatus.PENDING_REVIEW);
  });

  test("re-checks exact duplicates and needs explicit confirmation", async () => {
    const s = await service.create(vendorA, input(vendorA));
    // Someone added the same product to the catalog meanwhile
    repo.addGlobalProduct({ id: randomUUID(), name: "organic quinoa 500g", globalCategoryId: CATEGORY });
    await assert.rejects(service.approve(ADMIN, s.id, { revision: 1 }), (e: any) => e instanceof DuplicateConflictError && e.message === "duplicate_exists");
    assert.equal(repo.state.globalProducts.size, 1);
    const { submission } = await service.approve(ADMIN, s.id, { revision: 1, confirmNotDuplicate: true });
    assert.equal(submission.status, ProductSubmissionStatus.APPROVED);
    assert.equal(repo.state.globalProducts.size, 2);
  });

  test("requires a reviewer identity", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await rejects(service.approve({ userId: undefined, role: "ADMIN" }, s.id, { revision: 1 }), 400, "reviewer_required");
    await rejects(service.reject({ userId: "", role: "ADMIN" }, s.id, { revision: 1, reason: "x" }), 400, "reviewer_required");
  });
});

describe("link to an existing catalog product", () => {
  test("adds the existing product to the store instead of creating a duplicate", async () => {
    const existing = repo.addGlobalProduct({ id: randomUUID(), name: "Organic Quinoa Grain 500g", globalCategoryId: CATEGORY });
    const s = await service.create(vendorA, input(vendorA, { acknowledgedDuplicates: true }));
    const { submission } = await service.linkExisting(ADMIN, s.id, { revision: 1, globalProductId: existing.id });
    assert.equal(submission.status, ProductSubmissionStatus.APPROVED);
    assert.equal(submission.resolution, "LINKED_EXISTING");
    assert.equal(submission.globalProductId, existing.id);
    assert.equal(repo.state.globalProducts.size, 1, "no new global product");
    assert.equal(repo.liveVendorProducts(vendorA.vendorId).length, 1);
    assert.equal(media.promoteCalls, 0);
    assert.equal(media.privateObjects.size, 0);
    assert.equal(events.events[0].payload.resolution, "LINKED_EXISTING");
  });

  test("reuses a link the store already has (no second vendor product)", async () => {
    const existing = repo.addGlobalProduct({ id: randomUUID(), name: "Organic Quinoa Grain 500g", globalCategoryId: CATEGORY });
    repo.state.vendorProducts.push({
      id: "vp-existing",
      vendorId: vendorA.vendorId,
      globalProductId: existing.id,
      price: 42,
      stockQuantity: 7,
      stockWeightGrams: 0,
      isAvailable: true,
      deletedAt: null,
    });
    const s = await service.create(vendorA, input(vendorA, { acknowledgedDuplicates: true }));
    const { submission } = await service.linkExisting(ADMIN, s.id, { revision: 1, globalProductId: existing.id });
    assert.equal(submission.vendorProductId, "vp-existing");
    const links = repo.liveVendorProducts(vendorA.vendorId);
    assert.equal(links.length, 1);
    assert.equal(links[0].price, 42, "existing price untouched");
    assert.equal(links[0].stockQuantity, 7, "existing stock untouched");

    const again = await service.linkExisting(ADMIN, s.id, { revision: 1, globalProductId: existing.id });
    assert.equal(again.alreadyApplied, true);
    assert.equal(repo.liveVendorProducts(vendorA.vendorId).length, 1);
  });

  test("unknown catalog product", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await rejects(service.linkExisting(ADMIN, s.id, { revision: 1, globalProductId: randomUUID() }), 404, "global_product_not_found");
    await rejects(service.linkExisting(ADMIN, s.id, { revision: 1, globalProductId: "not-a-uuid" }), 400, "global_product_id_required");
    assert.equal(repo.state.submissions.get(s.id)!.status, ProductSubmissionStatus.PENDING_REVIEW);
  });

  test("removes the unused public copy left by an earlier failed approval", async () => {
    const existing = repo.addGlobalProduct({ id: randomUUID(), name: "Organic Quinoa Grain 500g", globalCategoryId: CATEGORY });
    const s = await service.create(vendorA, input(vendorA, { acknowledgedDuplicates: true }));
    repo.failOn.insertGlobalProduct = new Error("deadlock");
    await assert.rejects(service.approve(ADMIN, s.id, { revision: 1, confirmNotDuplicate: true }));
    const reservedId = repo.state.submissions.get(s.id)!.reservedGlobalProductId!;
    assert.ok(media.publicFolders.has(reservedId), "copied before the failed commit");
    await service.linkExisting(ADMIN, s.id, { revision: 1, globalProductId: existing.id });
    assert.equal(media.publicFolders.has(reservedId), false);
  });
});

describe("reject and request changes", () => {
  test("rejection needs a reason, notifies and deletes the private photo", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await rejects(service.reject(ADMIN, s.id, { revision: 1, reason: "  " }), 400, "review_reason_required");
    await rejects(service.reject(ADMIN, s.id, { revision: 1, reason: "x".repeat(1001) }), 400, "review_note_too_long");
    const { submission } = await service.reject(ADMIN, s.id, { revision: 1, reason: "Duplicate of an existing product" });
    assert.equal(submission.status, ProductSubmissionStatus.REJECTED);
    assert.equal(submission.reviewNote, "Duplicate of an existing product");
    assert.equal(submission.imageUrl, null);
    assert.equal(media.privateObjects.size, 0);
    assert.equal(events.events[0].payload.status, "REJECTED");
    assert.equal(events.events[0].payload.note, "Duplicate of an existing product");
    const again = await service.reject(ADMIN, s.id, { revision: 1, reason: "again" });
    assert.equal(again.alreadyApplied, true);
    assert.equal(events.events.length, 1);
    await rejects(service.approve(ADMIN, s.id, { revision: 1 }), 409, "submission_not_reviewable");
  });

  test("request changes needs feedback and only applies to pending proposals", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await rejects(service.requestChanges(ADMIN, s.id, { revision: 1 }), 400, "review_reason_required");
    await service.requestChanges(ADMIN, s.id, { revision: 1, feedback: "Add the weight to the name" });
    const repeat = await service.requestChanges(ADMIN, s.id, { revision: 1, feedback: "Add the weight to the name" });
    assert.equal(repeat.alreadyApplied, true);
    await rejects(service.approve(ADMIN, s.id, { revision: 1 }), 409, "submission_not_reviewable");
    // Still rejectable while waiting for the merchant
    const { submission } = await service.reject(ADMIN, s.id, { revision: 1, reason: "No response" });
    assert.equal(submission.status, ProductSubmissionStatus.REJECTED);
  });

  test("history keeps every decision with the reviewer for admins", async () => {
    const s = await service.create(vendorA, input(vendorA));
    await service.requestChanges(ADMIN, s.id, { revision: 1, feedback: "Better photo" });
    await service.update(vendorA, s.id, input(vendorA));
    await service.approve(ADMIN, s.id, { revision: 2 });
    const { submission } = await service.getForAdmin(s.id);
    assert.deepEqual(
      submission.history?.map((h) => [h.action, h.revision]),
      [
        ["SUBMITTED", 1],
        ["CHANGES_REQUESTED", 1],
        ["RESUBMITTED", 2],
        ["APPROVED", 2],
      ],
    );
    assert.equal(submission.history?.[1].actorUserId, ADMIN.userId);
    assert.equal(submission.history?.[1].note, "Better photo");
    assert.equal(submission.history?.[2].actorUserId, vendorA.userId);
  });
});

describe("orphan photo cleanup", () => {
  test("deletes photos no open proposal uses and keeps the others", async () => {
    const s = await service.create(vendorA, input(vendorA));
    const inUse = repo.state.submissions.get(s.id)!.imageKey;
    const neverAttached = uploadFor(vendorA);
    const result = await service.cleanupOrphanImages();
    assert.deepEqual(result, { checked: 2, deleted: 1 });
    assert.ok(media.privateObjects.has(inUse));
    assert.equal(media.privateObjects.has(neverAttached), false);
  });
});
