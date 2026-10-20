# Admin mobile app, real-time admin screens, admin notifications

> Started 2026-10-18. Schema changes are in `schema.sql` only (no migration, see the project's convention): reset the notification DB (`npm run db:reset && npm run db:seed`) before testing.

The Admin Web dashboard (`web/admin-dashboard`) is the source of truth. The Admin mobile app (`mobile/Admin`) re-implements every web screen on top of the same `/api/v1/admin/*` endpoints. Neither client holds business rules: the admin-service and the services behind it authorize every call (`authorize(UserRole.ADMIN)`) and validate every action.

## 1. Audit findings (before this work)

| Area | What the code did | Gap |
| --- | --- | --- |
| Admin roles | One role, `ADMIN`, checked on every admin route. No sub-permissions exist. | Nothing to mirror beyond "is ADMIN". |
| Real-time, web | `SocketContext` connects with the access token. Only `CouriersManagement` listened (to `COURIER_REVIEW_REQUESTED`). | Every other admin page needed a refresh. The socket kept the token it connected with, so a reconnect after the 15-minute token expiry failed. |
| Real-time, gateway | `websocket-gateway` sends **every** RabbitMQ event to room `role:ADMIN`. | Missing events: freelancer sign-up, office sign-up, new/edited product proposals, and every admin-made change (categories, tiers, settlements, users, ...). Admin-service didn't publish anything. |
| Notifications | `notification-service` stores notifications and sends FCM to customers, vendors, couriers, office managers. | Admins never got a notification. `device_tokens.app_type` has no `ADMIN`. `PATCH /notifications/:id/read` doesn't check the owner, so any user could mark anyone's notification read. No way to unregister a device on logout. Redelivered RabbitMQ messages create duplicate notifications. Read state isn't pushed to other devices. |
| Web notification UI | None (no bell, no list). Settings page is "Coming soon". | |
| Docs | `docs/notification-system.md` lists `ORDER_CREATED → Vendor` and `ORDER_CONFIRMED → Customer`; the code uses `VENDOR_ORDER_CREATED → vendor` and `VENDOR_ORDER_CONFIRMED → customer`. The device-token body also needs `appType`. | Doc is out of date. |
| Unused web API | `adminApi.getDeliveries`, `adminApi.updateOrderStatus`, `/admin/couriers/available` exist but no web screen uses them. | Not in the web app, so not a parity requirement. |

## 2. Route-to-mobile parity matrix

Every row lists the web route, the endpoints it uses, its filters, actions, the events that refresh it, and the mobile screen.

| Web route | Endpoints | Filters / paging | Actions and rules | Real-time (events → refresh) | Mobile screen |
| --- | --- | --- | --- | --- | --- |
| `/login` | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all` | — | Demo accounts. Non-admin accounts are refused by every admin endpoint; the mobile app also refuses them at sign-in. | — | `LoginScreen` |
| `/` Dashboard | `GET /admin/dashboard` | — | 5 stat cards (users, orders, vendors, couriers, revenue today) | order, user, vendor, courier events → stats | `DashboardScreen` (+ review-queue shortcuts) |
| `/orders` | `GET /admin/orders`, `GET /admin/orders/:id` | search (order id prefix), status, from/to dates, page 20 | Copy order id; details: summary, cancellation reason, vendor sub-orders, items, weights, pending proposals, address | all order/vendor-order/delivery/SLA events → list + open order | `OrdersScreen`, `OrderDetailsScreen` |
| `/users` | `GET /admin/users`, `GET /admin/users/:id/profile`, `PATCH /admin/users/:id/status`, `POST /admin/users/register` | search, role, status (active/inactive), page 20 | Create user (first/last name, email, password, role CUSTOMER/VENDOR/COURIER/ADMIN); activate / deactivate; details by role (customer, vendor shop, courier review panel, office review panel) | `USER_REGISTERED`, `ADMIN_DATA_CHANGED(users)` | `UsersScreen`, `UserDetailsScreen`, `CreateUserScreen` |
| `/vendors` | `GET /admin/vendors?approvalStatus`, `PATCH /admin/vendors/:id`, `/status`, `/approval`, `/image`, `GET /approval-history`, `POST /admin/vendors/register`, `POST /admin/vendors/:id/products/bulk-add-global` | approval (ALL/PENDING_REVIEW/APPROVED/REJECTED/SUSPENDED, server); search, shop status, type (client); page 20 | Review (details, map link, documents, history); approve; reject/suspend need a reason; create; edit; open/close; store image upload; add products from the catalog (multi-select, or a whole category, optional store category) | `VENDOR_REGISTERED`, `VENDOR_APPROVAL_UPDATED`, `VENDOR_STATUS_UPDATED`, `VENDOR_RATING_UPDATED`, `ADMIN_DATA_CHANGED(vendors)` | `VendorsScreen`, `VendorDetailsScreen`, `VendorFormScreen`, `AddVendorProductsScreen` |
| `/couriers` | `GET /admin/couriers`, `/count`, `/:id/details`, `PATCH /:id/approval`, `PATCH /:id/deactivate`, `POST /admin/couriers/register`, `GET /admin/delivery-offices?approvalStatus=APPROVED` | type (ALL/OFFICE/FREELANCE/PENDING_REVIEW), search, status, page 20 | Approve (not approved); reject (pending); suspend (approved); deactivate (one-way); create (office courier needs an approved office) | `COURIER_REVIEW_REQUESTED`, `COURIER_APPROVAL_UPDATED`, delivery events, `ADMIN_DATA_CHANGED(couriers)` | `CouriersScreen`, `CourierDetailsScreen`, `CreateCourierScreen` |
| `/delivery-offices` | `GET /admin/delivery-offices`, `/:id/details`, `PATCH /:id/approval`, `POST /admin/delivery-offices` | approval (ALL/PENDING_REVIEW/APPROVED/SUSPENDED), search, page 20 | Approve; suspend; create (office + manager login, password ≥ 8) | `OFFICE_REVIEW_REQUESTED`, `OFFICE_APPROVAL_UPDATED`, `ADMIN_DATA_CHANGED(delivery-offices)` | `OfficesScreen`, `OfficeDetailsScreen`, `CreateOfficeScreen` |
| `/ratings` | `GET /admin/vendors`, `GET /admin/vendors/:id/ratings`, `GET /admin/delivery-ratings`, `GET /admin/delivery-offices`, `GET /admin/couriers` | vendors: search, sorted by count then average, page 20; deliveries: filter by office or courier, server paging (hasNextPage) | Read-only: summary, distribution, latest reviews | `VENDOR_REVIEW_CREATED`, `VENDOR_RATING_UPDATED`, `ORDER_DELIVERED` | `RatingsScreen` (two tabs), `VendorReviewsScreen` |
| `/products` | `GET/POST /admin/products`, `PUT/DELETE /admin/products/:id`, `PATCH /:id/image`, `GET/POST /admin/global-products`, `DELETE /admin/global-products/:id`, `POST /admin/global-products/bulk`, `GET /admin/categories`, `POST /media/upload` | vendor listings: search (≥ 3 chars), vendor, global category, store category (linked to vendor), reset, page 20; global: search, page 20 | Edit price/stock/categories; activate/deactivate; delete; upload/view image; create vendor listing (from a global product) or global product; bulk CSV import (category, measurement type, weight unit; several files one after another) | `PRODUCT_AVAILABILITY_CHANGED`, `LOW_STOCK`, `STOCK_RESERVED`, `PRODUCT_SUBMISSION_REVIEWED`, `ADMIN_DATA_CHANGED(products, global-products)` | `ProductsScreen` (two tabs), `ProductFormScreen`, `BulkImportScreen`, image viewer |
| `/product-submissions` | `GET /admin/product-submissions`, `/:id`, `POST /:id/approve`, `/link`, `/reject`, `/request-changes`, `GET /admin/vendors/:id`, `GET /admin/global-products` | status (PENDING_REVIEW default, NEEDS_CHANGES, APPROVED, REJECTED, CANCELLED, ALL), search, page 20 | Approve (with `duplicate_exists` → "approve anyway"); link to a duplicate or a searched catalog product; request changes / reject (text required); revision guard (`submission_changed_reload`) | `PRODUCT_SUBMISSION_CREATED`, `PRODUCT_SUBMISSION_REVIEWED` | `SubmissionsScreen`, `SubmissionReviewScreen` |
| `/categories` | `GET/POST /admin/categories`, `PATCH/DELETE /:id`, `PATCH /:id/icon` | tab (all/global/vendor, vendor tab grouped by store), search, store | Create/edit (type, store for vendor type, name, description); delete with confirmation; icon upload | `ADMIN_DATA_CHANGED(categories)` | `CategoriesScreen`, `CategoryFormScreen` |
| `/financial-analytics` | vendor: `/admin/settlements/vendor/:id/pending`, `/admin/settlements`, `POST`, `PATCH /:id/mark-paid`; courier: `/admin/delivery-settlements/overview`, `/courier/:id/pending`, `/courier`, `POST`, `PATCH mark-paid`; office: `/office/pending`, `/office`, `POST`, `PATCH mark-paid` | section (vendors/couriers/offices); target picker (office: "all offices" allowed); tab pending/history | Create settlement (period, notes; disabled with nothing unsettled); mark paid (PENDING only); freelancer cash netting shown | `ORDER_DELIVERED`, `ADMIN_DATA_CHANGED(settlements, delivery-settlements)` | `FinanceScreen`, `CreateSettlementScreen` |
| `/commission-tiers` | `GET/POST /admin/commission-tiers`, `PATCH/DELETE /:id`, `GET /admin/vendors` | sorted global → type → vendor → min | Create/edit (scope global / vendor type / vendor; min; max empty = ∞; %); delete with confirmation; server errors shown in the form | `ADMIN_DATA_CHANGED(commission-tiers)` | `CommissionTiersScreen`, `CommissionTierFormScreen` |
| `/delivery-fee-tiers` | `GET/POST /admin/delivery-fee-tiers`, `PATCH/DELETE /:id` | — | Create/edit with courier + office + platform = 100; optional freelance split (both empty, or both summing to 100); delete with confirmation | `ADMIN_DATA_CHANGED(delivery-fee-tiers)` | `DeliveryFeeTiersScreen`, `DeliveryFeeTierFormScreen` |
| `/settings` | — (placeholder on web) | — | Web: language, logout, logout all devices (navbar). | — | `SettingsScreen`: language, notification permission + push preference, connection status, server (dev), logout, logout all |
| (new) notifications | `GET /notification/notifications`, `PATCH /:id/read`, `PATCH /read-all`, `GET/PATCH /notification/notifications/preferences`, `POST/DELETE /notification/device-token` | page 20 | Open the related screen; mark read; mark all read | `NOTIFICATION_CREATED`, `NOTIFICATION_READ` (to that admin's devices only) | Web: navbar bell + `/notifications`; mobile: `NotificationsScreen` |

Final status of each row is in §7.

## 3. Real-time design

```
business operation (service DB write commits)
  → RabbitMQ event (citymarket_events, routing key = event type)
  → websocket-gateway: authorized rooms only
       role:ADMIN  ← every domain event + ADMIN_DATA_CHANGED, with eventId
       user:<id>   ← NOTIFICATION_CREATED / NOTIFICATION_READ for that user only
  → client realtime manager: dedupe by eventId, map event → query keys
  → TanStack Query invalidate (active queries refetch with their current filters/page)
  → UI
```

* Events are hints: clients refetch the authoritative record instead of trusting the payload.
* Lists keep filters, sorting and page because the query key already contains them; invalidation refetches the same key, and `placeholderData` keeps the old rows on screen during the refetch.
* Missed events: on every (re)connect and every app foregrounding, the client invalidates all admin queries once. This reconciles anything missed while offline without a replay log.
* Expired tokens: the socket reads the current access token in its `auth` callback on every connection attempt, so reconnects use the refreshed token. An auth error triggers one token refresh, then a reconnect.
* Stale responses: TanStack Query cancels/ignores superseded fetches for the same key; mutations invalidate after success only.
* Notification events never go to `role:ADMIN` (they'd leak other users' notifications).
* `ADMIN_DATA_CHANGED { resource, resourceId, action, actorUserId }` is published by admin-service after any successful mutating request (2xx). It is also logged as an audit line. It goes to `role:ADMIN` only.

## 4. Admin notifications

Same table, same API and same delivery code for web and mobile. A notification row belongs to one admin user; read state lives in the DB and is pushed to all of that admin's sockets (`NOTIFICATION_READ`), so reading on the web clears the badge on the phone and the other way round.

### Matrix

| Event | When | Notification (in-app) | Push (FCM, admin devices) |
| --- | --- | --- | --- |
| `VENDOR_REGISTERED` (self-registration or resubmission, status PENDING_REVIEW) | merchant applies | yes | yes |
| `COURIER_REVIEW_REQUESTED` | office manager requests a courier, or a freelancer signs up | yes | yes |
| `OFFICE_REVIEW_REQUESTED` | office self-registers | yes | yes |
| `PRODUCT_SUBMISSION_CREATED` | merchant proposes / resubmits a product | yes | yes |
| `DELIVERY_FAILED` | courier marks a delivery failed | yes | yes |
| `SLA_COURIER_PICKUP_EXPIRED` | courier didn't pick up in time | yes | yes |
| `SLA_DELIVERY_ACCEPTANCE_EXPIRED` | no office accepted in time | yes | no (in-app only; frequent) |
| `SLA_VENDOR_CONFIRMATION_EXPIRED` | merchant didn't confirm, order cancelled | yes | no |
| `VENDOR_ORDER_CREATED` (once per customer order, even when split across stores) | customer places an order | yes | yes |
| `ORDER_CANCELLED` (once per order) | order cancelled by anyone | yes | yes |
| Other order progress (confirmed, ready, picked up, delivered) | — | no (real-time list update only) | no |

* Badges (mobile): `GET /notifications/unread-summary` returns the unread items per screen (`vendor`, `courier`, `office`, `submission`, `order`; distinct ids). The Review tab badge is the sum of the first four, the Orders tab badge is `order`, and list rows with unread notifications show "New". Opening an item calls `PATCH /notifications/read-target { screen, id }`, which marks all of that item's notifications read and sends `NOTIFICATION_READ` to the admin's other devices.
* Recipients: every active ADMIN user, read from auth-service (`GET /users?role=ADMIN`) with notification-service's service token, cached 60 s.
* Preferences: `notification_preferences.push_enabled` per admin (`GET/PATCH /notifications/preferences`). In-app notifications are always stored.
* Duplicates: each notification has a `dedupe_key` (`<event id>`), unique per user. A redelivered RabbitMQ message inserts nothing and sends no push.
* Devices: `POST /device-token` with `appType: ADMIN`; `DELETE /device-token` on logout removes the token. Tokens FCM reports as unregistered/invalid are deleted (existing behaviour).
* Web push: not configured anywhere in the repo (no Firebase web config / VAPID key). The web uses in-app notifications over the socket. Browser push is optional and needs those keys.

## 5. Mobile app

`mobile/Admin` (React Native 0.83, same stack as the other four apps; `mobile/` is gitignored like the others). Navigation: bottom tabs (Dashboard, Orders, Reviews, Catalog, More) with native stacks; every web page is reachable from "More". Tokens are stored in Keychain/Keystore (`react-native-keychain`); access-token refresh is queued like the other apps.

## 6. Configuration

See the final report in the session and §8 for environment variables and Firebase setup.

## 7. Parity status

(filled in at the end)
