# Merchant product proposals (vendor-submitted products + admin approval)

> Implemented 2026-10-15. Schema changes are in `schema.sql` only (no migration): reset the catalog DB (`npm run db:reset && npm run db:seed`) before testing.

Merchants could only add products that already exist in the global catalog. They can now **propose** a missing product. A proposal is never visible to customers and never sellable by itself: only an admin decision publishes a global product (or links an existing one) and adds it to the merchant's store through the normal add-from-catalog logic, with price 0 / stock 0 / not available. The merchant then sets price and stock as for any other product. Price and stock are never part of a proposal or of the global product.

## States (`product_submissions.status`)

| From                              | To               | Who      | Notes                                               |
| --------------------------------- | ---------------- | -------- | --------------------------------------------------- |
| —                                 | `PENDING_REVIEW` | merchant | `POST /catalog/product-submissions`                 |
| `PENDING_REVIEW`                  | `PENDING_REVIEW` | merchant | edit (`PUT`), revision + 1                          |
| `PENDING_REVIEW`                  | `APPROVED`       | admin    | approve (new global product) or link (existing one) |
| `PENDING_REVIEW`                  | `NEEDS_CHANGES`  | admin    | feedback required                                   |
| `PENDING_REVIEW`, `NEEDS_CHANGES` | `REJECTED`       | admin    | reason required, final                              |
| `NEEDS_CHANGES`                   | `PENDING_REVIEW` | merchant | edit = resubmit, revision + 1                       |
| `PENDING_REVIEW`, `NEEDS_CHANGES` | `CANCELLED`      | merchant | withdraw, final                                     |

`APPROVED`, `REJECTED` and `CANCELLED` are final: edits are refused (`submission_not_editable`), so nothing a merchant sends can change a published global product. Every change is written to `product_submission_history` (action, status, revision, note, actor user id and role, field snapshot).

Admin decisions must send the `revision` they reviewed. If the merchant edited the proposal meanwhile, the decision fails with `submission_changed_reload` (409) and the dashboard reloads it.

## API

catalog-service (gateway prefix `/api/v1/catalog`):

| Method | Path                                                                                 | Who                                    |
| ------ | ------------------------------------------------------------------------------------ | -------------------------------------- |
| POST   | `/product-submissions/check-duplicates` `{ name, globalCategoryId? }`                | approved merchant                      |
| POST   | `/product-submissions`                                                               | approved merchant                      |
| GET    | `/product-submissions/mine?status=&page=&limit=`                                     | approved merchant (own only)           |
| GET    | `/product-submissions/:id`                                                           | approved merchant (own only, else 404) |
| PUT    | `/product-submissions/:id` (no `imageKey` = keep the photo)                          | approved merchant (own, open only)     |
| POST   | `/product-submissions/:id/cancel`                                                    | approved merchant (own, open only)     |
| GET    | `/admin/product-submissions?status=&search=&vendorId=&page=&limit=`                  | ADMIN / service                        |
| GET    | `/admin/product-submissions/:id` → `{ submission, duplicates, similarPending }`      | ADMIN / service                        |
| POST   | `/admin/product-submissions/:id/approve` `{ revision, note?, confirmNotDuplicate? }` | ADMIN / service + `X-User-Id`          |
| POST   | `/admin/product-submissions/:id/link` `{ revision, globalProductId, note? }`         | ADMIN / service + `X-User-Id`          |
| POST   | `/admin/product-submissions/:id/reject` `{ revision, reason }`                       | ADMIN / service + `X-User-Id`          |
| POST   | `/admin/product-submissions/:id/request-changes` `{ revision, feedback }`            | ADMIN / service + `X-User-Id`          |

admin-service (`/api/v1/admin/product-submissions...`) forwards the same calls with its service token and the admin's id in `X-User-Id`. It passes catalog-service's 4xx status and body through (new `DownstreamError`), so the dashboard gets real error codes and the duplicate matches.

media-service (`/api/v1/media`):

| Method | Path                                                                                                                          | Who                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| GET    | `/media/submission-images/rules`                                                                                              | any signed-in user              |
| POST   | `/media/submission-images` (multipart `file`) → `{ key, width, height, bytes, previewUrl }`                                   | VENDOR user token, rate limited |
| POST   | `/media/private/stat`, `/media/private/signed-urls`, `/media/private/promote`, `/media/private/list`; DELETE `/media/private` | service tokens only             |

Merchants can't set status, reviewer, product ids, price or stock: only name, description, category, measurement type / weight unit, image key and "I confirm it's different" are read from their requests. The merchant's store is always taken from `GET /vendors/me` (approved and active, as for other catalog writes); admins and services can't create proposals (`vendor_only`).

## Approval

1. **Reserve** (transaction, proposal row locked): must be `PENDING_REVIEW` at the given revision. A global product id is reserved on the proposal (`reserved_global_product_id`) and reused by every retry.
2. **Publish the photo** (outside the transaction): media-service copies the private photo to `globals/<reservedId>/large.webp` through the existing image pipeline. Writing it again is harmless.
3. **Commit** (one transaction, the category row and the proposal row locked): re-check state, revision and exact duplicates in the category; insert the global product with the reserved id; add the store's vendor product through `VendorProductRepository.addFromGlobalProducts` (the logic used by bulk add); set `APPROVED`, reviewer, ids; write history.
4. **After commit**: delete the private photo, publish `PRODUCT_SUBMISSION_REVIEWED`.

Idempotency and failures:

- A repeated or concurrent approval finds `APPROVED` and returns `{ alreadyApplied: true }`: no second product, link or notification. Locking the category row serializes approvals in one category.
- Photo publish failure: 502 `image_promotion_failed`, nothing visible changed, retry works. If the merchant replaced the photo meanwhile: 409 `submission_changed_reload`.
- Database failure in step 3: rolled back; the public copy under the reserved id has no product yet and is overwritten by the retry. If the proposal is rejected, withdrawn or linked instead, that copy is deleted (only when no global product has that id).
- Failure in step 4: logged; the orphan cleanup deletes the private photo later. Event publish failures are logged, as elsewhere.

**Link existing** adds the chosen global product to the store with the same add-from-catalog logic, reusing a live row the store already has (its price and stock are untouched).

## Photos

- Rules (media-service env, defaults): JPEG / PNG / WebP (`SUBMISSION_IMAGE_FORMATS`), at least 800 × 800 after EXIF rotation (`SUBMISSION_IMAGE_MIN_WIDTH/HEIGHT`), at most 5 MB (`SUBMISSION_IMAGE_MAX_BYTES`, enforced by multer), at most 40 MP (`SUBMISSION_IMAGE_MAX_PIXELS`). `GET /media/submission-images/rules` serves them to the apps, which pre-check before uploading.
- Checked on content: magic bytes, compared with the declared MIME type (`image_type_mismatch`), sharp metadata, then a full decode (`failOn: "truncated"`) to catch damaged files. Animated images are refused.
- Normalized: EXIF orientation applied, metadata stripped, re-encoded as WebP fitting inside 1600 px without cropping or stretching (never shrunk below the minimum).
- Stored in **`R2_PRIVATE_BUCKET`** (a bucket with public access off) at `product-submissions/<uploader user id>/<random>.webp`, shown only through 10-minute signed URLs (`PRIVATE_SIGNED_URL_TTL_SECONDS`). catalog-service only accepts keys that contain the merchant's own user id and exist. Without `R2_PRIVATE_BUCKET`, uploads fail with 503 unless `SUBMISSION_ALLOW_PUBLIC_BUCKET=true` (development only: photos then sit in the public bucket under unguessable keys).
- Per-merchant upload limit: 20 per 10 minutes (`SUBMISSION_UPLOAD_LIMIT`, `SUBMISSION_UPLOAD_WINDOW_MS`), in memory per instance, on top of nginx's per-IP limits.
- Cleanup: replaced photos are deleted on edit; photos of decided / withdrawn proposals are deleted after the decision; catalog-service deletes private photos older than 24 h that no open proposal uses, every 6 h (`SUBMISSION_IMAGE_CLEANUP_INTERVAL_MS`, `SUBMISSION_IMAGE_CLEANUP_GRACE_SECONDS`; 0 disables). Published catalog images are in the public bucket and never touched by the cleanup.
- Watermarks, ads, prices or the wrong product can't be detected automatically. The admin panel shows the photo with a reminder to check these.

## Duplicates

- Names are normalized (case, spacing, punctuation, Latin accents, Arabic alef / taa marbuta / yaa variants, diacritics, tatweel, Arabic-Indic digits, a leading "ال", "500g" → "500 g") and compared by token similarity. Sizes stay different ("1 kg" ≠ "5 kg"); nothing is merged automatically.
- The catalog has no brand or barcode fields, so they aren't used.
- Merchant: the form starts with a catalog search by name (part of a name is enough, e.g. "quin" finds "Quinoa"). A product found there is added to the store right away with the merchant's price and quantity (bulk-add endpoint; the server rejects negative / non-numeric values, and a product with stock but no price is never marked available).
- Server guard: a proposal whose normalized name equals a catalog product in the same category is refused with 409 `product_already_in_catalog` (with the match) — on create and on edit, with no "it's different" override. Close but not identical names (another size or variant), or the same name in another category, return 409 `possible_duplicates` until the merchant ticks "my product is different".
- One open proposal per store, category and normalized name (unique key `uq_submission_open_name`); one proposal per photo (`uq_submission_image`).
- Admin: the panel lists catalog matches (with "Link this") and similar open proposals from other stores, and can search the catalog to link. Approval re-checks same-name products in the category under lock and needs `confirmNotDuplicate` to go ahead.
- `vendor_products` now has `uq_vendor_active_global_product` (one live row per store and global product, soft-deleted rows excluded). Bulk add skips rows added concurrently (`ON DUPLICATE KEY UPDATE`). `POST /products` for a product the store already sells returns 409 `vendor_product_already_exists`; before, it created a second row.

## Notifications

`PRODUCT_SUBMISSION_REVIEWED` (`status` APPROVED / REJECTED / NEEDS_CHANGES) → notification-service push + stored notification (type `PRODUCT_SUBMISSION`, Arabic/English text in `shared/src/locales`) and websocket `user:<merchant user id>` so the apps refresh. It is published once per real state change. A redelivered RabbitMQ message would notify twice, as for the other events.

## Apps

- **Vendor dashboard**: "New product requests" page (`/product-submissions`: list, status filter, detail with feedback and history, edit / resubmit, withdraw, "Set price and stock" → `/products?edit=<vendorProductId>`), the 3-step propose dialog, and a "Propose a new product" button on Products.
- **Vendor app**: Products tab is now a stack: Products → requests list → detail → form. Header button on Products, "Can't find it?" link in the bulk-add picker, notification tap opens the detail, "Set price and stock" opens the price sheet for that product.
- **Admin dashboard**: "Product proposals" page (`/product-submissions`): queue (pending first), review dialog with photo, fields, duplicates, link search, history, approve / request changes / reject / link.

## Deployment

1. Create an R2 bucket with public access **off** and set `R2_PRIVATE_BUCKET` for media-service (the same R2 key needs access to it).
2. Database: all changes are in `services/catalog-service/src/infrastructure/database/schema.sql` (no migration). Reset the catalog DB: `npm run db:reset && npm run db:seed` (or `./scripts/deploy.sh --update --reset-db` on the server).
3. Rebuild `shared` (apps and services read its `dist/`).

## Tests

- `services/catalog-service`: `npm test` (service workflow with an in-memory repository, HTTP authorization, name normalization). With `CATALOG_TEST_DB_HOST/_PORT/_USER/_PASSWORD` it also runs `catalog.mysql.test.ts` against a throwaway database created from `schema.sql` (real SQL, constraints, concurrent approvals and bulk adds, rollback, add-from-catalog regressions).
- `services/media-service`: `npm test` (content validation with real images, upload / private endpoints over HTTP). With `MEDIA_TEST_S3_ENDPOINT/_KEY/_SECRET` it also checks private storage against an S3-compatible server (e.g. MinIO): metadata, signed URLs work, unsigned and tampered URLs are refused.

## Add r2 configuration

You're seeing that warning because media-service has no private bucket set. services/media-service/.env (and the root .env that Docker uses) only have R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET, with no R2_PRIVATE_BUCKET.

Product-proposal photos are kept private until an admin approves them. Without a private bucket the upload is refused on purpose: it returns 503 private_storage_not_configured and logs that warning. Your current bucket is public (served via r2.dev), so using it would let anyone with the link see unapproved photos.

There are two ways to fix it:

Option 1: create a private bucket (recommended, and required for production)

1. In the Cloudflare dashboard, go to R2 and create a bucket, e.g. citymarket-media-private. Leave public access off: no r2.dev URL and no custom domain.
2. Make sure your existing R2 API token can read and write that bucket. A token scoped to all buckets already can; a token limited to citymarket-media needs the new bucket added.
3. Add this line to services/media-service/.env (local npm run dev) and to the root .env (Docker):
   R2_PRIVATE_BUCKET=citymarket-media-private
4. Restart media-service.

Option 2: quick local testing only
Add this to services/media-service/.env:
SUBMISSION_ALLOW_PUBLIC_BUCKET=true
Proposal photos then go into your existing public bucket under random, unguessable paths. That works for testing, but the photos are reachable by anyone who has the link, so don't use it in production.

After either change, the startup warning R2_PRIVATE_BUCKET not set... goes away and uploads work.

I haven't edited your .env files because they hold your credentials. I can add the line if you tell me which option you want.
