import { randomUUID } from "crypto";
import {
  AppError,
  CategoryType,
  EventType,
  MeasurementType,
  NotFoundError,
  ProductSubmissionAction,
  ProductSubmissionResolution,
  ProductSubmissionStatus,
  ValidationError,
  WeightUnit,
  type ProductDuplicateMatch,
  type ProductSubmission,
  type ProductSubmissionDecisionResult,
  type ProductSubmissionHistoryEntry,
  type SimilarPendingSubmission,
} from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { ICategoryRepository } from "../../core/interfaces/category.repository";
import { IProductSubmissionRepository, ProductSubmissionTx } from "../../core/interfaces/product-submission.repository";
import { ISubmissionMedia } from "../../core/interfaces/submission-media";
import { CatalogCandidate, ProductSubmissionHistoryRecord, ProductSubmissionRecord } from "../../core/entities/product-submission.entity";
import { candidateLikePatterns, nameSimilarity, normalizeProductName } from "../utils/product-name";

const MIN_NAME = 2;
const MAX_NAME = 255;
const MAX_DESCRIPTION = 2000;
const MAX_NOTE = 1000;
const MAX_PAGE_SIZE = 50;
const CANDIDATE_LIMIT = 300;
const MATCH_LIMIT = 10;
// Shown as "similar" from this name similarity (0..1)
const SIMILAR_SCORE = 0.5;
// A merchant must confirm before submitting when a match is this close in the same category
const STRONG_SAME_CATEGORY_SCORE = 0.75;

const OPEN_STATUSES = [ProductSubmissionStatus.PENDING_REVIEW, ProductSubmissionStatus.NEEDS_CHANGES];
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export interface VendorActor {
  userId: string;
  vendorId: string;
}

export interface ReviewerActor {
  userId: string | undefined;
  role: string;
}

export interface SubmissionEventPublisher {
  publish(event: { id: string; type: EventType; payload: Record<string, unknown>; createdAt: Date; timestamp: Date }): Promise<void>;
}

// 409 carrying the matches the client should show
export class DuplicateConflictError extends AppError {
  constructor(
    message: "possible_duplicates" | "duplicate_exists" | "product_already_in_catalog",
    public readonly matches: ProductDuplicateMatch[],
  ) {
    super(409, message);
    Object.setPrototypeOf(this, DuplicateConflictError.prototype);
  }
}

interface ParsedInput {
  name: string;
  normalizedName: string;
  description: string | null;
  globalCategoryId: string;
  measurementType: MeasurementType;
  weightUnit: WeightUnit | null;
  imageKey: string;
  acknowledgedDuplicates: boolean;
}

// Only these fields are read from a merchant request; status, reviewer, product ids, price and
// stock can't be set through it.
export function parseSubmissionInput(body: any, options: { imageOptional?: boolean } = {}): ParsedInput {
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < MIN_NAME) throw new ValidationError("submission_name_required");
  if (name.length > MAX_NAME) throw new ValidationError("submission_name_too_long");
  const normalizedName = normalizeProductName(name);
  if (!normalizedName) throw new ValidationError("submission_name_required");

  const rawDescription = typeof body?.description === "string" ? body.description.trim() : "";
  if (rawDescription.length > MAX_DESCRIPTION) throw new ValidationError("submission_description_too_long");

  const globalCategoryId = typeof body?.globalCategoryId === "string" ? body.globalCategoryId.trim() : "";
  if (!globalCategoryId) throw new ValidationError("invalid_global_category");

  const measurementType = body?.measurementType ?? MeasurementType.UNIT;
  if (!Object.values(MeasurementType).includes(measurementType)) throw new ValidationError("invalid_measurement_type");
  let weightUnit: WeightUnit | null = null;
  if (measurementType === MeasurementType.WEIGHT) {
    if (!Object.values(WeightUnit).includes(body?.weightUnit)) throw new ValidationError("invalid_weight_unit");
    weightUnit = body.weightUnit;
  }

  const imageKey = typeof body?.imageKey === "string" ? body.imageKey.trim() : "";
  // On an edit, no key means "keep the current photo"
  if (!imageKey && !options.imageOptional) throw new ValidationError("submission_image_required");

  return {
    name,
    normalizedName,
    description: rawDescription || null,
    globalCategoryId,
    measurementType,
    weightUnit,
    imageKey,
    acknowledgedDuplicates: body?.acknowledgedDuplicates === true,
  };
}

function parseRevision(value: unknown): number {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 1) throw new ValidationError("revision_required");
  return revision;
}

function parseNote(value: unknown, required: boolean): string | null {
  const note = typeof value === "string" ? value.trim() : "";
  if (required && !note) throw new ValidationError("review_reason_required");
  if (note.length > MAX_NOTE) throw new ValidationError("review_note_too_long");
  return note || null;
}

export function parseStatuses(value: unknown): ProductSubmissionStatus[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const all = Object.values(ProductSubmissionStatus) as string[];
  const statuses = value.split(",").map((s) => s.trim().toUpperCase());
  if (statuses.some((s) => !all.includes(s))) throw new ValidationError("invalid_status");
  return statuses as ProductSubmissionStatus[];
}

export function parsePaging(page: unknown, limit: unknown): { page: number; limit: number; offset: number } {
  const p = Math.max(1, parseInt(String(page), 10) || 1);
  const l = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(limit), 10) || 20));
  return { page: p, limit: l, offset: (p - 1) * l };
}

export class ProductSubmissionService {
  constructor(
    private readonly repo: IProductSubmissionRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly media: ISubmissionMedia,
    private readonly events: SubmissionEventPublisher,
  ) {}

  // ── Merchant ────────────────────────────────────────────────────────────────

  // Possible catalog matches for a name the merchant is about to propose
  async checkDuplicates(body: any): Promise<ProductDuplicateMatch[]> {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < MIN_NAME) throw new ValidationError("submission_name_required");
    if (name.length > MAX_NAME) throw new ValidationError("submission_name_too_long");
    const categoryId = typeof body?.globalCategoryId === "string" && body.globalCategoryId ? body.globalCategoryId : null;
    // Search as you type: also names that contain what was typed ("quin" -> "Quinoa")
    return this.findCatalogMatches(name, categoryId, { includeContaining: true });
  }

  async create(actor: VendorActor, body: any): Promise<ProductSubmission> {
    const input = parseSubmissionInput(body);
    await this.assertGlobalCategory(input.globalCategoryId);
    const image = await this.checkOwnImage(actor, input.imageKey);
    await this.assertNoUnconfirmedDuplicates(input);

    const now = new Date();
    const record: ProductSubmissionRecord = {
      id: randomUUID(),
      vendorId: actor.vendorId,
      submittedByUserId: actor.userId,
      status: ProductSubmissionStatus.PENDING_REVIEW,
      name: input.name,
      normalizedName: input.normalizedName,
      description: input.description,
      globalCategoryId: input.globalCategoryId,
      measurementType: input.measurementType,
      weightUnit: input.weightUnit,
      imageKey: input.imageKey,
      imageWidth: image.width,
      imageHeight: image.height,
      revision: 1,
      vendorAcknowledgedDuplicates: input.acknowledgedDuplicates,
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      resolution: null,
      reservedGlobalProductId: null,
      globalProductId: null,
      vendorProductId: null,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.withTransaction(async (tx) => {
      await tx.insert(record);
      await tx.addHistory(this.historyEntry(record, ProductSubmissionAction.SUBMITTED, record.status, record.revision, null, actor.userId, "VENDOR"));
    });
    Logger.info("Product submission created", { submissionId: record.id, vendorId: actor.vendorId });
    await this.publishQueued(record, ProductSubmissionAction.SUBMITTED, record.revision);
    return this.getForVendor(actor, record.id);
  }

  async listForVendor(actor: VendorActor, query: any): Promise<{ data: ProductSubmission[]; total: number; page: number; limit: number }> {
    const { page, limit, offset } = parsePaging(query?.page, query?.limit);
    const { items, total } = await this.repo.list({ vendorId: actor.vendorId, statuses: parseStatuses(query?.status), limit, offset });
    const urls = await this.media.signedUrls(items.filter(isOpen).map((s) => s.imageKey));
    return { data: items.map((s) => this.toDto(s, false, urls[s.imageKey])), total, page, limit };
  }

  async getForVendor(actor: VendorActor, id: string): Promise<ProductSubmission> {
    const submission = await this.repo.findById(id);
    // Another store's proposal looks exactly like a missing one
    if (!submission || submission.vendorId !== actor.vendorId) throw new NotFoundError("submission_not_found");
    const [history, urls] = await Promise.all([
      this.repo.findHistory(id),
      isOpen(submission) ? this.media.signedUrls([submission.imageKey]) : Promise.resolve({} as Record<string, string>),
    ]);
    return { ...this.toDto(submission, false, urls[submission.imageKey]), history: history.map((h) => historyDto(h, false)) };
  }

  // Full replacement of the proposal's fields. Allowed while it waits for review (it stays
  // PENDING_REVIEW) or after changes were requested (it goes back to PENDING_REVIEW). Every edit
  // bumps the revision, so an admin can't approve a version they haven't seen. Approved,
  // rejected and cancelled proposals are final: editing them is refused, and an approved
  // global product is never touched from here.
  async update(actor: VendorActor, id: string, body: any): Promise<ProductSubmission> {
    const input = parseSubmissionInput(body, { imageOptional: true });
    const current = await this.repo.findById(id);
    if (!current || current.vendorId !== actor.vendorId) throw new NotFoundError("submission_not_found");
    if (!isOpen(current)) throw new AppError(409, "submission_not_editable");
    if (!input.imageKey) input.imageKey = current.imageKey;
    await this.assertGlobalCategory(input.globalCategoryId);
    const imageChanged = input.imageKey !== current.imageKey;
    const image = imageChanged ? await this.checkOwnImage(actor, input.imageKey) : { width: current.imageWidth, height: current.imageHeight };
    await this.assertNoUnconfirmedDuplicates(input);

    const result = await this.repo.withTransaction(async (tx) => {
      const locked = await tx.lockById(id);
      if (!locked || locked.vendorId !== actor.vendorId) throw new NotFoundError("submission_not_found");
      if (!isOpen(locked)) throw new AppError(409, "submission_not_editable");
      const resubmitted = locked.status === ProductSubmissionStatus.NEEDS_CHANGES;
      const revision = locked.revision + 1;
      await tx.update(id, {
        status: ProductSubmissionStatus.PENDING_REVIEW,
        name: input.name,
        normalizedName: input.normalizedName,
        description: input.description,
        globalCategoryId: input.globalCategoryId,
        measurementType: input.measurementType,
        weightUnit: input.weightUnit,
        imageKey: input.imageKey,
        imageWidth: image.width,
        imageHeight: image.height,
        revision,
        vendorAcknowledgedDuplicates: input.acknowledgedDuplicates,
        submittedAt: resubmitted ? new Date() : undefined,
      });
      const updated: ProductSubmissionRecord = { ...locked, ...input, imageWidth: image.width, imageHeight: image.height, revision };
      await tx.addHistory(
        this.historyEntry(
          updated,
          resubmitted ? ProductSubmissionAction.RESUBMITTED : ProductSubmissionAction.UPDATED,
          ProductSubmissionStatus.PENDING_REVIEW,
          revision,
          null,
          actor.userId,
          "VENDOR",
        ),
      );
      const action = resubmitted ? ProductSubmissionAction.RESUBMITTED : ProductSubmissionAction.UPDATED;
      return { replaced: locked.imageKey !== input.imageKey ? locked.imageKey : null, queued: { record: updated, action, revision } };
    });

    if (result.replaced) await this.safeDeletePrivate(result.replaced);
    await this.publishQueued(result.queued.record, result.queued.action, result.queued.revision);
    return this.getForVendor(actor, id);
  }

  // Withdraw a proposal that hasn't been decided yet
  async cancel(actor: VendorActor, id: string): Promise<ProductSubmission> {
    const result = await this.repo.withTransaction(async (tx) => {
      const locked = await tx.lockById(id);
      if (!locked || locked.vendorId !== actor.vendorId) throw new NotFoundError("submission_not_found");
      if (locked.status === ProductSubmissionStatus.CANCELLED) return { submission: locked, changed: false };
      if (!isOpen(locked)) throw new AppError(409, "submission_not_editable");
      await tx.update(id, { status: ProductSubmissionStatus.CANCELLED });
      await tx.addHistory(this.historyEntry(locked, ProductSubmissionAction.CANCELLED, ProductSubmissionStatus.CANCELLED, locked.revision, null, actor.userId, "VENDOR"));
      return { submission: locked, changed: true };
    });
    if (result.changed) await this.cleanupAfterFinal(result.submission);
    return this.getForVendor(actor, id);
  }

  // ── Admin review ────────────────────────────────────────────────────────────

  async listForAdmin(query: any): Promise<{ data: ProductSubmission[]; total: number; page: number; limit: number }> {
    const { page, limit, offset } = parsePaging(query?.page, query?.limit);
    const search = typeof query?.search === "string" ? query.search.trim().slice(0, 100) : undefined;
    const vendorId = typeof query?.vendorId === "string" && query.vendorId ? query.vendorId : undefined;
    const { items, total } = await this.repo.list({ statuses: parseStatuses(query?.status), search: search || undefined, vendorId, limit, offset });
    const urls = await this.media.signedUrls(items.filter(isOpen).map((s) => s.imageKey));
    return { data: items.map((s) => this.toDto(s, true, urls[s.imageKey])), total, page, limit };
  }

  async getForAdmin(id: string): Promise<{
    submission: ProductSubmission;
    duplicates: ProductDuplicateMatch[];
    similarPending: SimilarPendingSubmission[];
  }> {
    const submission = await this.repo.findById(id);
    if (!submission) throw new NotFoundError("submission_not_found");
    const patterns = candidateLikePatterns(submission.name);
    const [history, urls, duplicates, openSimilar] = await Promise.all([
      this.repo.findHistory(id),
      isOpen(submission) ? this.media.signedUrls([submission.imageKey]) : Promise.resolve({} as Record<string, string>),
      this.findCatalogMatches(submission.name, submission.globalCategoryId),
      this.repo.findOpenByName(patterns, id, CANDIDATE_LIMIT),
    ]);
    const similarPending = openSimilar
      .map((s) => ({ s, score: nameSimilarity(submission.name, s.name), exact: s.normalizedName === submission.normalizedName }))
      .filter((m) => m.exact || m.score >= SIMILAR_SCORE)
      .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score)
      .slice(0, MATCH_LIMIT)
      .map(({ s, score, exact }) => ({
        id: s.id,
        vendorId: s.vendorId,
        name: s.name,
        status: s.status,
        score: exact ? 1 : round(score),
        submittedAt: toIso(s.submittedAt)!,
      }));
    return {
      submission: { ...this.toDto(submission, true, urls[submission.imageKey]), history: history.map((h) => historyDto(h, true)) },
      duplicates,
      similarPending,
    };
  }

  // Creates the global product from the proposal and adds it to the merchant's store.
  //  1. Reserve a global product id on the proposal (reused by every retry).
  //  2. Copy the private photo to the public catalog under that id. Object storage is not part
  //     of the database transaction; the copy is idempotent (same source, same destination).
  //  3. In one transaction, with the category and the proposal locked: re-check the state, the
  //     revision and exact duplicates, insert the global product, add the store's vendor
  //     product through the add-from-catalog logic, mark the proposal APPROVED, write history.
  //  4. After commit: delete the private photo, notify the merchant.
  // A repeated or concurrent approval finds the proposal APPROVED and returns it unchanged. If
  // step 2 or 3 fails nothing visible changed; the admin can simply retry.
  async approve(reviewer: ReviewerActor, id: string, body: any): Promise<ProductSubmissionDecisionResult> {
    const reviewerId = assertReviewer(reviewer);
    const revision = parseRevision(body?.revision);
    const note = parseNote(body?.note, false);
    const confirmNotDuplicate = body?.confirmNotDuplicate === true;

    const reserved = await this.repo.withTransaction(async (tx) => {
      const s = await tx.lockById(id);
      if (!s) throw new NotFoundError("submission_not_found");
      if (s.status === ProductSubmissionStatus.APPROVED) return { already: true as const };
      assertReviewable(s, revision);
      const reservedId = s.reservedGlobalProductId ?? randomUUID();
      if (!s.reservedGlobalProductId) await tx.update(id, { reservedGlobalProductId: reservedId });
      return { already: false as const, submission: s, reservedId };
    });
    if (reserved.already) return this.alreadyApplied(id);
    const { submission, reservedId } = reserved;

    // Cheap early answer before touching storage; re-checked under lock below
    if (!confirmNotDuplicate) {
      const exact = await this.exactCatalogDuplicates(submission, this.repo);
      if (exact.length > 0) throw new DuplicateConflictError("duplicate_exists", exact);
    }

    let imageUrl: string;
    try {
      imageUrl = (await this.media.promote(submission.imageKey, reservedId)).url;
    } catch (error) {
      Logger.error("Product submission image promotion failed", { submissionId: id, error: (error as Error)?.message });
      // The merchant edited it meanwhile (an edit deletes the replaced photo)
      const latest = await this.repo.findById(id).catch(() => null);
      if (latest && (latest.revision !== revision || latest.imageKey !== submission.imageKey)) {
        throw new AppError(409, "submission_changed_reload");
      }
      // Validation problems with the stored photo (e.g. missing) are reported as such
      if (error instanceof AppError && (error.statusCode === 400 || error.statusCode === 404)) throw error;
      throw new AppError(502, "image_promotion_failed");
    }

    let outcome: { already: boolean; vendorProductId?: string };
    try {
      outcome = await this.repo.withTransaction(async (tx) => {
        const category = await tx.lockGlobalCategory(submission.globalCategoryId);
        if (!category) throw new ValidationError("invalid_global_category");
        const s = await tx.lockById(id);
        if (!s) throw new NotFoundError("submission_not_found");
        if (s.status === ProductSubmissionStatus.APPROVED) return { already: true };
        assertReviewable(s, revision);
        if (s.reservedGlobalProductId !== reservedId || s.imageKey !== submission.imageKey) throw new AppError(409, "submission_changed_reload");
        if (!confirmNotDuplicate) {
          const exact = await this.exactCatalogDuplicates(s, tx);
          if (exact.length > 0) throw new DuplicateConflictError("duplicate_exists", exact);
        }

        const now = new Date();
        await tx.insertGlobalProduct({
          id: reservedId,
          name: s.name,
          description: s.description ?? undefined,
          imageUrl,
          globalCategoryId: s.globalCategoryId,
          measurementType: s.measurementType,
          weightUnit: s.weightUnit ?? undefined,
          createdAt: now,
          updatedAt: now,
        });
        const { vendorProductId } = await tx.ensureVendorProduct(s.vendorId, reservedId);
        await tx.update(id, {
          status: ProductSubmissionStatus.APPROVED,
          resolution: ProductSubmissionResolution.CREATED,
          globalProductId: reservedId,
          vendorProductId,
          reviewedBy: reviewerId,
          reviewedAt: now,
          reviewNote: note,
        });
        await tx.addHistory(this.historyEntry(s, ProductSubmissionAction.APPROVED, ProductSubmissionStatus.APPROVED, s.revision, note, reviewerId, reviewer.role));
        return { already: false, vendorProductId };
      });
    } catch (error) {
      // The public copy has no product yet. If the proposal can no longer be approved (it was
      // rejected or withdrawn meanwhile), remove the copy; otherwise a retry overwrites it.
      await this.cleanupReservedIfFinal(id);
      throw error;
    }
    if (outcome.already) return this.alreadyApplied(id);

    Logger.info("Product submission approved", { submissionId: id, globalProductId: reservedId, reviewerId });
    await this.safeDeletePrivate(submission.imageKey);
    await this.publishDecision(submission, ProductSubmissionStatus.APPROVED, note, {
      resolution: ProductSubmissionResolution.CREATED,
      globalProductId: reservedId,
      vendorProductId: outcome.vendorProductId,
    });
    return { submission: (await this.getForAdmin(id)).submission };
  }

  // The proposal is a product the catalog already has: add that product to the merchant's
  // store (no new global product, the existing add-from-catalog logic, no second link).
  async linkExisting(reviewer: ReviewerActor, id: string, body: any): Promise<ProductSubmissionDecisionResult> {
    const reviewerId = assertReviewer(reviewer);
    const revision = parseRevision(body?.revision);
    const note = parseNote(body?.note, false);
    const globalProductId = typeof body?.globalProductId === "string" ? body.globalProductId.trim() : "";
    if (!new RegExp(`^${UUID}$`, "i").test(globalProductId)) throw new ValidationError("global_product_id_required");

    const outcome = await this.repo.withTransaction(async (tx) => {
      const s = await tx.lockById(id);
      if (!s) throw new NotFoundError("submission_not_found");
      if (s.status === ProductSubmissionStatus.APPROVED) {
        if (s.resolution === ProductSubmissionResolution.LINKED_EXISTING && s.globalProductId === globalProductId) return { already: true as const };
        throw new AppError(409, "submission_not_reviewable");
      }
      assertReviewable(s, revision);
      const product = await tx.findLiveGlobalProduct(globalProductId);
      if (!product) throw new NotFoundError("global_product_not_found");
      const { vendorProductId } = await tx.ensureVendorProduct(s.vendorId, globalProductId);
      await tx.update(id, {
        status: ProductSubmissionStatus.APPROVED,
        resolution: ProductSubmissionResolution.LINKED_EXISTING,
        globalProductId,
        vendorProductId,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note,
      });
      await tx.addHistory(
        this.historyEntry(s, ProductSubmissionAction.LINKED_EXISTING, ProductSubmissionStatus.APPROVED, s.revision, note, reviewerId, reviewer.role, {
          linkedGlobalProductId: globalProductId,
        }),
      );
      return { already: false as const, submission: s, vendorProductId, productName: product.name };
    });
    if (outcome.already) return this.alreadyApplied(id);

    await this.cleanupAfterFinal(outcome.submission);
    await this.publishDecision(outcome.submission, ProductSubmissionStatus.APPROVED, note, {
      resolution: ProductSubmissionResolution.LINKED_EXISTING,
      globalProductId,
      vendorProductId: outcome.vendorProductId,
      productName: outcome.productName,
    });
    return { submission: (await this.getForAdmin(id)).submission };
  }

  async reject(reviewer: ReviewerActor, id: string, body: any): Promise<ProductSubmissionDecisionResult> {
    const reviewerId = assertReviewer(reviewer);
    const revision = parseRevision(body?.revision);
    const reason = parseNote(body?.reason, true)!;

    const outcome = await this.repo.withTransaction(async (tx) => {
      const s = await tx.lockById(id);
      if (!s) throw new NotFoundError("submission_not_found");
      if (s.status === ProductSubmissionStatus.REJECTED) return { already: true as const };
      // A proposal waiting for the merchant's changes can still be rejected
      if (!isOpen(s)) throw new AppError(409, "submission_not_reviewable");
      if (s.revision !== revision) throw new AppError(409, "submission_changed_reload");
      await tx.update(id, { status: ProductSubmissionStatus.REJECTED, reviewNote: reason, reviewedBy: reviewerId, reviewedAt: new Date() });
      await tx.addHistory(this.historyEntry(s, ProductSubmissionAction.REJECTED, ProductSubmissionStatus.REJECTED, s.revision, reason, reviewerId, reviewer.role));
      return { already: false as const, submission: s };
    });
    if (outcome.already) return this.alreadyApplied(id);

    await this.cleanupAfterFinal(outcome.submission);
    await this.publishDecision(outcome.submission, ProductSubmissionStatus.REJECTED, reason);
    return { submission: (await this.getForAdmin(id)).submission };
  }

  async requestChanges(reviewer: ReviewerActor, id: string, body: any): Promise<ProductSubmissionDecisionResult> {
    const reviewerId = assertReviewer(reviewer);
    const revision = parseRevision(body?.revision);
    const feedback = parseNote(body?.feedback, true)!;

    const outcome = await this.repo.withTransaction(async (tx) => {
      const s = await tx.lockById(id);
      if (!s) throw new NotFoundError("submission_not_found");
      if (s.status === ProductSubmissionStatus.NEEDS_CHANGES && s.revision === revision) return { already: true as const };
      assertReviewable(s, revision);
      await tx.update(id, { status: ProductSubmissionStatus.NEEDS_CHANGES, reviewNote: feedback, reviewedBy: reviewerId, reviewedAt: new Date() });
      await tx.addHistory(
        this.historyEntry(s, ProductSubmissionAction.CHANGES_REQUESTED, ProductSubmissionStatus.NEEDS_CHANGES, s.revision, feedback, reviewerId, reviewer.role),
      );
      return { already: false as const, submission: s };
    });
    if (outcome.already) return this.alreadyApplied(id);

    await this.publishDecision(outcome.submission, ProductSubmissionStatus.NEEDS_CHANGES, feedback);
    return { submission: (await this.getForAdmin(id)).submission };
  }

  // ── Maintenance ─────────────────────────────────────────────────────────────

  // Deletes private photos older than the grace period that no open proposal uses: uploads
  // never attached to a proposal, photos replaced by an edit, and photos of decided proposals
  // whose delete failed. Published catalog images live in the public bucket and are untouched.
  async cleanupOrphanImages(olderThanSeconds = 24 * 60 * 60, limit = 5000): Promise<{ checked: number; deleted: number }> {
    const keys = await this.media.listPrivateOlderThan(olderThanSeconds, limit);
    if (keys.length === 0) return { checked: 0, deleted: 0 };
    const inUse = await this.repo.findOpenImageKeys(keys);
    let deleted = 0;
    for (const key of keys) {
      if (inUse.has(key)) continue;
      if (await this.safeDeletePrivate(key)) deleted++;
    }
    if (deleted > 0) Logger.info("Deleted orphaned product-proposal photos", { deleted, checked: keys.length });
    return { checked: keys.length, deleted };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async alreadyApplied(id: string): Promise<ProductSubmissionDecisionResult> {
    return { submission: (await this.getForAdmin(id)).submission, alreadyApplied: true };
  }

  private async assertGlobalCategory(id: string): Promise<void> {
    const category = await this.categoryRepo.findById(id);
    if (!category || category.type !== CategoryType.GLOBAL) throw new ValidationError("invalid_global_category");
  }

  // The key must be one this merchant uploaded (the uploader's user id is part of it) and the
  // object must exist in private storage
  private async checkOwnImage(actor: VendorActor, key: string): Promise<{ width: number | null; height: number | null }> {
    const own = new RegExp(`^product-submissions/${escapeRegex(actor.userId)}/${UUID}\\.webp$`, "i");
    if (!own.test(key)) throw new ValidationError("submission_image_invalid");
    const info = await this.media.stat(key);
    if (!info.exists) throw new ValidationError("submission_image_missing");
    return { width: info.width ?? null, height: info.height ?? null };
  }

  // A product with the same (normalized) name in the same category is already in the catalog:
  // the merchant must add that one to their store, there is no "it's different" override.
  // Close but not identical names (another size / variant) only need the merchant's confirmation.
  private async assertNoUnconfirmedDuplicates(input: ParsedInput): Promise<void> {
    const matches = await this.findCatalogMatches(input.name, input.globalCategoryId);
    const existing = matches.filter((m) => m.exact && m.sameCategory);
    if (existing.length > 0) throw new DuplicateConflictError("product_already_in_catalog", existing);
    if (input.acknowledgedDuplicates) return;
    if (matches.some((m) => m.exact || (m.sameCategory && m.score >= STRONG_SAME_CATEGORY_SCORE))) {
      throw new DuplicateConflictError("possible_duplicates", matches);
    }
  }

  async findCatalogMatches(name: string, globalCategoryId: string | null, options: { includeContaining?: boolean } = {}): Promise<ProductDuplicateMatch[]> {
    const candidates = await this.repo.findCatalogCandidates(candidateLikePatterns(name), null, CANDIDATE_LIMIT);
    return rankMatches(name, globalCategoryId, candidates, options.includeContaining);
  }

  // Global products in the same category whose normalized name is identical
  private async exactCatalogDuplicates(s: ProductSubmissionRecord, source: Pick<ProductSubmissionTx, "findCatalogCandidates">): Promise<ProductDuplicateMatch[]> {
    const candidates = await source.findCatalogCandidates(candidateLikePatterns(s.name), s.globalCategoryId, CANDIDATE_LIMIT);
    return rankMatches(s.name, s.globalCategoryId, candidates).filter((m) => m.exact && m.sameCategory);
  }

  // Private photo and any unused reserved catalog image of a proposal that just became final
  private async cleanupAfterFinal(s: ProductSubmissionRecord): Promise<void> {
    await this.safeDeletePrivate(s.imageKey);
    if (s.reservedGlobalProductId) await this.deleteUnusedReservedImage(s.reservedGlobalProductId);
  }

  private async cleanupReservedIfFinal(id: string): Promise<void> {
    try {
      const s = await this.repo.findById(id);
      if (!s?.reservedGlobalProductId) return;
      if (s.status === ProductSubmissionStatus.REJECTED || s.status === ProductSubmissionStatus.CANCELLED) {
        await this.deleteUnusedReservedImage(s.reservedGlobalProductId);
      }
    } catch (error) {
      Logger.warn("Reserved image cleanup check failed", { submissionId: id, error: (error as Error)?.message });
    }
  }

  // Only when no global product was created with that id (never deletes a published image)
  private async deleteUnusedReservedImage(globalProductId: string): Promise<void> {
    try {
      if (await this.repo.globalProductExists(globalProductId)) return;
      await this.media.deletePublicFolder(globalProductId);
    } catch (error) {
      Logger.warn("Failed to delete unused reserved catalog image", { globalProductId, error: (error as Error)?.message });
    }
  }

  private async safeDeletePrivate(key: string): Promise<boolean> {
    try {
      await this.media.deletePrivate(key);
      return true;
    } catch (error) {
      // The orphan cleanup retries later
      Logger.warn("Failed to delete private product-proposal photo", { key, error: (error as Error)?.message });
      return false;
    }
  }

  // The admin review queue changed (new proposal, edit or resubmission). Published after the
  // transaction commits; a failed publish only delays the admins' live refresh.
  private async publishQueued(s: ProductSubmissionRecord, action: ProductSubmissionAction, revision: number): Promise<void> {
    try {
      const now = new Date();
      await this.events.publish({
        id: randomUUID(),
        type: EventType.PRODUCT_SUBMISSION_CREATED,
        payload: { submissionId: s.id, vendorId: s.vendorId, productName: s.name, action, revision },
        createdAt: now,
        timestamp: now,
      });
    } catch (error) {
      Logger.warn("Failed to publish PRODUCT_SUBMISSION_CREATED", { submissionId: s.id, error: (error as Error)?.message });
    }
  }

  private async publishDecision(
    s: ProductSubmissionRecord,
    status: ProductSubmissionStatus,
    note: string | null,
    extra: { resolution?: ProductSubmissionResolution; globalProductId?: string; vendorProductId?: string; productName?: string } = {},
  ): Promise<void> {
    try {
      const now = new Date();
      await this.events.publish({
        id: randomUUID(),
        timestamp: now,
        type: EventType.PRODUCT_SUBMISSION_REVIEWED,
        payload: {
          submissionId: s.id,
          vendorId: s.vendorId,
          vendorUserId: s.submittedByUserId,
          status,
          productName: extra.productName ?? s.name,
          note,
          resolution: extra.resolution ?? null,
          globalProductId: extra.globalProductId ?? null,
          vendorProductId: extra.vendorProductId ?? null,
        },
        createdAt: now,
      });
    } catch (error) {
      Logger.warn("Failed to publish PRODUCT_SUBMISSION_REVIEWED", { submissionId: s.id, error: (error as Error)?.message });
    }
  }

  private historyEntry(
    s: Pick<ProductSubmissionRecord, "id" | "name" | "description" | "globalCategoryId" | "measurementType" | "weightUnit" | "imageKey">,
    action: ProductSubmissionAction,
    status: ProductSubmissionStatus,
    revision: number,
    note: string | null,
    actorUserId: string | null,
    actorRole: string | null,
    extra: Record<string, unknown> = {},
  ): ProductSubmissionHistoryRecord {
    return {
      id: randomUUID(),
      submissionId: s.id,
      action,
      status,
      revision,
      note,
      actorUserId,
      actorRole,
      snapshot: {
        name: s.name,
        description: s.description,
        globalCategoryId: s.globalCategoryId,
        measurementType: s.measurementType,
        weightUnit: s.weightUnit,
        imageKey: s.imageKey,
        ...extra,
      },
      createdAt: new Date(),
    };
  }

  private toDto(s: ProductSubmissionRecord, admin: boolean, signedImageUrl?: string): ProductSubmission {
    // Open: the private photo (signed URL). Approved: the published catalog image. Rejected or
    // withdrawn: the photo was deleted.
    const imageUrl = isOpen(s) ? (signedImageUrl ?? null) : s.status === ProductSubmissionStatus.APPROVED ? (s.publishedImageUrl ?? null) : null;
    const dto: ProductSubmission = {
      id: s.id,
      vendorId: s.vendorId,
      status: s.status,
      name: s.name,
      description: s.description,
      globalCategoryId: s.globalCategoryId,
      globalCategoryName: s.globalCategoryName ?? null,
      measurementType: s.measurementType,
      weightUnit: s.weightUnit,
      imageUrl,
      imageWidth: s.imageWidth,
      imageHeight: s.imageHeight,
      revision: s.revision,
      reviewNote: s.reviewNote,
      reviewedAt: toIso(s.reviewedAt),
      resolution: s.resolution,
      globalProductId: s.globalProductId,
      vendorProductId: s.vendorProductId,
      vendorAcknowledgedDuplicates: s.vendorAcknowledgedDuplicates,
      submittedAt: toIso(s.submittedAt)!,
      createdAt: toIso(s.createdAt)!,
      updatedAt: toIso(s.updatedAt)!,
    };
    if (admin) {
      dto.submittedByUserId = s.submittedByUserId;
      dto.reviewedBy = s.reviewedBy;
    }
    return dto;
  }
}

function rankMatches(name: string, globalCategoryId: string | null, candidates: CatalogCandidate[], includeContaining = false): ProductDuplicateMatch[] {
  const normalized = normalizeProductName(name);
  return candidates
    .map((c) => {
      const candidateName = normalizeProductName(c.name);
      const exact = candidateName === normalized;
      const similarity = round(nameSimilarity(name, c.name));
      // Typed text found inside the catalog name: list it even if the words aren't complete yet
      const contains = includeContaining && candidateName.includes(normalized);
      return {
        globalProductId: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
        globalCategoryId: c.globalCategoryId,
        globalCategoryName: c.globalCategoryName,
        measurementType: c.measurementType,
        weightUnit: c.weightUnit,
        score: exact ? 1 : contains ? Math.max(similarity, SIMILAR_SCORE) : similarity,
        exact,
        sameCategory: !!globalCategoryId && c.globalCategoryId === globalCategoryId,
      };
    })
    .filter((m) => m.exact || m.score >= SIMILAR_SCORE)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.sameCategory) - Number(a.sameCategory) || b.score - a.score)
    .slice(0, MATCH_LIMIT);
}

function isOpen(s: Pick<ProductSubmissionRecord, "status">): boolean {
  return OPEN_STATUSES.includes(s.status);
}

// Decisions apply to a proposal waiting for review, at the revision the admin looked at
function assertReviewable(s: ProductSubmissionRecord, revision: number): void {
  if (s.status !== ProductSubmissionStatus.PENDING_REVIEW) throw new AppError(409, "submission_not_reviewable");
  if (s.revision !== revision) throw new AppError(409, "submission_changed_reload");
}

function assertReviewer(reviewer: ReviewerActor): string {
  if (!reviewer.userId) throw new ValidationError("reviewer_required");
  return reviewer.userId;
}

function historyDto(h: ProductSubmissionHistoryRecord, admin: boolean): ProductSubmissionHistoryEntry {
  const entry: ProductSubmissionHistoryEntry & { snapshot?: Record<string, unknown> | null } = {
    id: h.id,
    submissionId: h.submissionId,
    action: h.action,
    status: h.status,
    revision: h.revision,
    note: h.note,
    createdAt: toIso(h.createdAt)!,
  };
  if (admin) {
    entry.actorUserId = h.actorUserId;
    entry.actorRole = h.actorRole;
    entry.snapshot = h.snapshot;
  }
  return entry;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
