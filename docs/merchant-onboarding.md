# Merchant Onboarding (registration, documents, admin approval)

> Implemented 2026-10-14. Not yet run against a live stack: reset the DBs (`npm run db:reset && npm run db:seed`) first, since `vendors` has new columns and a new `vendor_approval_history` table (schema.sql only, no migration).

Follows the delivery-office pattern (`delivery_offices.approval_status` + document URLs, a gate in the app, an admin review panel, an `*_APPROVAL_UPDATED` event).

## Flow

1. **Account**: `POST /auth/register` with `role: VENDOR` (web `/register`, Vendor app "Register your store"). The merchant is signed in at once.
2. **Application**: `GET /vendors/me` returns 404 → the gate shows the 4-step application: store (name, category = `VendorType`, owner name, phone, description) → location (address + map pin / current location) → documents → review.
3. **Documents** upload to media-service, folder `vendor-documents` (JPEG/PNG/WEBP, ≤ 10 MB). The server picks a random path, like courier and office documents. Required: owner's national ID and commercial register. Optional: tax card.
4. **Submit**: `POST /vendors/register` (VENDOR). The store is created `PENDING_REVIEW`, shop `CLOSED`, and a history row is added. The app shows a confirmation only after this succeeds.
5. **Review**: the admin dashboard Vendors page has an approval filter and a Review dialog with details, documents, map link and history. Approve, reject (reason required) or suspend (reason required) through `PATCH /admin/vendors/:id/approval` → vendor-service `PATCH /:id/approval`.
6. **Decision**: `VENDOR_APPROVAL_UPDATED` → websocket `user:<vendorUserId>` (the gate refetches) + push notification.
7. **Rejected**: the merchant sees the reason, corrects the application and calls `PUT /vendors/me/registration`, which sets it back to `PENDING_REVIEW`. The application can also be corrected while still pending.

## States (`vendors.approval_status`)

| From | To | Who |
| --- | --- | --- |
| — | `PENDING_REVIEW` | merchant self-registration |
| — | `APPROVED` | admin-created / seeded vendors (column default) |
| `PENDING_REVIEW` | `APPROVED`, `REJECTED` | admin |
| `REJECTED` | `PENDING_REVIEW` | merchant resubmits |
| `REJECTED` | `APPROVED` | admin |
| `APPROVED` | `SUSPENDED` | admin (shop is closed at once) |
| `SUSPENDED` | `APPROVED` | admin |

The status is never taken from a merchant request. Every transition is written to `vendor_approval_history`, with the admin's user id (forwarded as `X-User-Id` by admin-service) or the merchant's user id.

## Backend enforcement

Approval is read live from vendor-service (`GET /me` with the caller's token) on every protected request. No token claim or cache is involved, so a decision applies on the next request.

- **vendor-service**: `POST /` is ADMIN/service only (merchants use `/register`). `PATCH /:id`, `/:id/status`, `/:id/working-hours` and `/:id/image` require the caller to own the store (`not_your_store`) and, for merchants, to be approved (`vendor_not_approved`). Nobody can set a non-approved store `OPEN`, and merchants can't set `SUSPENDED`. Customers only see approved stores (`GET /`, `GET /:id`). Owner name, documents and review fields are stripped for anyone who isn't the owner, an admin or a service.
- **catalog-service**: product create/update/stock/price/image/delete, bulk-add and vendor-category writes require an approved merchant writing to their own store (`presentation/middlewares/vendor-access.ts`). The product's `vendorId` is forced or checked server-side. Global-product writes are ADMIN/service only. `/products/:id/release` is service/ADMIN only.
- **order-service**: `/vendor/:vendorId`, `/vendor/:vendorId/financials` and `/vendor-orders/:id` (+ accept / propose / status) require an approved merchant on their own store, or ADMIN/service. `/stats` and `GET /` are ADMIN/service only.
- **order-service, customer side** (2026-10-14): `GET /customer-orders/:id`, `GET /customer-orders/:id/proposals`, `POST /customer-orders/:id/resolve-cancellation` and `POST /proposals/:id/accept|reject` are allowed for the order's own customer, ADMIN and service tokens. Anyone else gets the same 404 as a missing order. A proposal is traced proposal → item → vendor order → customer order. `PATCH /customer-orders/:id/status` is ADMIN/service only; no app calls it, and setting `COMPLETED` by hand commits stock.
- **media-service**: VENDOR can't delete files under any `*-documents` folder.
- **auth-service**: public signup allows only CUSTOMER, VENDOR, COURIER and DELIVERY_MANAGER. Other roles need a service token.

## Known limitations

- The R2 bucket is public: document URLs are unguessable but not signed. This is the same as courier and office documents; moving all three to private storage with signed URLs is still open.
- `PATCH /catalog/products/:id/image` changes the image of the shared *global* product (pre-existing). An approved merchant can change the picture other stores see for that product.
- A suspended merchant can't open their vendor orders, so in-flight orders fall to the existing vendor SLAs.
