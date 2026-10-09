# Delivery Service Audit & Freelance Couriers Plan

> Status: **Phases 1–3 implemented 2026-10-08** (backend, websocket, notifications, admin dashboard, Courier app, load test). Phase 4 (customer sees/calls courier) is planned below. Not yet run against a live stack — reset the DBs (`npm run db:reset && npm run db:seed`) before testing; schema changes live in `schema.sql` only, no migration scripts.
> Written 2026-10-07.
> Scope: `services/delivery-service` plus the touch points in `admin-service`, `notification-service`, `websocket-gateway`, the Courier mobile app, Delivery mobile app, and the admin/delivery dashboards.
>
> Goal: fix the existing defects first (Phase 1–2), then add **freelance couriers** (couriers not tied to any delivery office) so the platform can keep delivering if offices stop working with us (Phase 3).

---

## 1. Current model

```
ORDER_READY → delivery PENDING  (fee split fixed here: courier% / office% / platform%)
   → office accepts (first office wins)   → ACCEPTED   [courier_assignment SLA]
   → office assigns one of its couriers   → ASSIGNED   [courier_pickup SLA]
   → PICKED_UP → ON_THE_WAY → DELIVERED
```

- **Couriers settlement:** office manager (or admin) settles a courier's `courier_fee_amount` → `courier_settlements`.
- **Office settlement:** admin settles an office's `office_fee_amount` → `delivery_office_settlements`.
- **Fee tiers:** `delivery_fee_tiers` maps a delivery-fee range to `courier_percentage + office_percentage + platform_percentage = 100`.
- `couriers.delivery_office_id` is already nullable, so the schema half-supports office-less couriers, but no flow handles them.

---

## 2. Findings

Severity: 🔴 must fix before opening the platform to freelancers · 🟠 functional bug · 🟡 minor/cleanup

### 2.1 Security / authorization

| #   | Sev | Finding                                                                                                                                                                               | Location                                                                                  | Fix                                                                                                                                                                           |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | 🔴  | `updateDeliveryStatus` has no ownership check. Any COURIER can move any delivery's status, and any DELIVERY_MANAGER can do it for any office's delivery.                              | `delivery.service.ts` `updateDeliveryStatus`; route `PATCH /deliveries/:id/status`        | Pass `userId`/`role` from controller. COURIER: `delivery.courierId === myCourier.id`. MANAGER: `delivery.deliveryOfficeId === myOffice.id`. ADMIN: allowed.                   |
| S2  | 🔴  | `PATCH /couriers/:id` and `PATCH /couriers/:id/availability` don't check ownership. Any courier can edit any courier, and any manager can edit couriers outside their office.         | `delivery.routes.ts`, `delivery.service.ts` `updateCourier` / `updateCourierAvailability` | COURIER: only own record. MANAGER: only couriers of own office. Consider `PATCH /couriers/me/availability` instead of `:id`.                                                  |
| S3  | 🔴  | `GET /deliveries/:id` returns customer phone + address to any courier/manager.                                                                                                        | `delivery.controller.ts` `getDeliveryById`                                                | Same ownership rule as S1 (managers may also see PENDING unclaimed deliveries, without customer phone).                                                                       |
| S4  | 🔴  | `GET /couriers/available` with role COURIER returns **all** available couriers (with phones). A manager with no office record also falls back to all couriers.                        | `delivery.service.ts` `getAvailableCouriers`                                              | Remove COURIER from the route, or return only self. Manager without office → `NotFoundError`, not a fallback to everything. Same for `getAllCouriers` and `getAllDeliveries`. |
| S5  | 🔴  | `assignCourier` doesn't verify the courier belongs to the manager's office, or is `is_active`/`is_available`. A manager can assign another office's courier (or a future freelancer). | `delivery.service.ts` `assignCourier`                                                     | Check `courier.deliveryOfficeId === office.id`, `isActive`, `isAvailable`. Lock the courier row (`SELECT … FOR UPDATE`) to prevent double assignment.                         |
| S6  | 🔴  | The websocket gateway broadcasts **every** event to `role:DELIVERY_MANAGER`, so every office sees every other office's deliveries.                                                    | `websocket-gateway/src/events.ts` (step 5)                                                | Join managers to `office:<officeId>`. Broadcast PENDING/new-delivery events to all offices; broadcast post-accept events only to the owning office.                           |
| S7  | 🟡  | `POST /couriers` takes `userId` from the request body; admin can register a courier profile on any user, including non-COURIER users.                                                 | `delivery.controller.ts` `registerCourier`                                                | Verify via auth/user service that the user's role is COURIER.                                                                                                                 |

### 2.2 Delivery flow / SLA bugs

| #   | Sev | Finding                                                                                                                                                                                                                | Location                                                                                              | Fix                                                                                                                                                                                                  |
| --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 🟠  | `registerCourier` never sets `delivery_office_id`, even when a DELIVERY_MANAGER creates the courier. Only the seed script links couriers to offices, so real office couriers don't show in the office's courier lists. | `delivery.service.ts` `registerCourier`, `delivery.controller.ts`                                     | If caller is MANAGER → set `deliveryOfficeId = myOffice.id`. If ADMIN → accept an optional `deliveryOfficeId` (and later `courierType`). Admin `createCourier` in `admin-service` should forward it. |
| F2  | 🟠  | Assignment SLA expiry reverts the delivery to `PENDING` but **does not reschedule the acceptance SLA**. The delivery can sit in PENDING forever.                                                                       | `application/workers/sla.worker.ts` `handleAssignmentExpired`                                         | After revert, call `slaManager.scheduleAcceptanceSla(...)` (inject the manager into the worker, or publish and reschedule).                                                                          |
| F3  | 🟠  | Pickup SLA expiry reverts to `ACCEPTED` but doesn't clear `courier_id` (the old courier still sees it in "my deliveries") and doesn't reschedule the assignment SLA, so it's stuck in ACCEPTED forever.                | `sla.worker.ts` `handlePickupExpired`; `delivery.repository.ts` `update` (has no `courierId` support) | Add `clearCourier()` to the repo (`courier_id = NULL, assigned_at = NULL`). After revert, schedule an assignment SLA. For freelance deliveries, revert to PENDING instead (see §3).                  |
| F4  | 🟠  | A courier who can't make it has no way out except `cancel-by-courier`, which marks the delivery `FAILED`. **Correction (2026-10-08):** `cancel-by-courier` itself is intentional: its reasons in the Courier app are all customer-caused (not available / refused / wrong address), so failing the order and penalising the customer is right there. What was missing is a courier-caused exit. | `delivery.service.ts` `cancelDeliveryByCourier`                                                       | Kept `cancel-by-courier` as is. Added `PATCH /deliveries/:id/release`: office delivery → back to `ACCEPTED`, courier cleared, assignment SLA rescheduled, office notified; freelance → back to `PENDING` pool. `cancellation_count++` in both. |
| F5  | 🟡  | `acceptedWindowMinutes` is passed to `deliveryRepo.acceptDelivery` but never used.                                                                                                                                     | `delivery.repository.ts` `acceptDelivery`                                                             | Remove the argument, or use it for the office-first window (§3.3).                                                                                                                                   |
| F6  | 🟠  | `PATCH /couriers/:id/deactivate` is called by `admin-service` (`DeliveryClient.deactivateCourier`) and `user-service`, but the route doesn't exist. Admins can't deactivate couriers.                                  | `delivery.routes.ts`                                                                                  | Add the route (ADMIN, plus MANAGER for own office) → `is_active = FALSE, is_available = FALSE`. Block deactivation while the courier has an active delivery, or reassign it.                         |
| F7  | 🟡  | On `DELIVERED`, courier availability and `total_deliveries` are updated outside any transaction with the status update.                                                                                                | `delivery.service.ts` `updateDeliveryStatus`                                                          | Wrap in `db.withTransaction`.                                                                                                                                                                        |
| F8  | 🟡  | `updateDeliveryStatus` loads the delivery via `getDeliveryById`, which makes HTTP calls to order and user services before validating the transition.                                                                   | same                                                                                                  | Validate the transition on the raw row first; enrich only when needed for event payloads.                                                                                                            |
| F9  | 🟡  | `cancelDeliveryByManager` doesn't cancel the SLA jobs.                                                                                                                                                                 | `delivery.service.ts`                                                                                 | Call `slaManager.cancelAllSlas`.                                                                                                                                                                     |

### 2.3 Settlements / money

| #   | Sev | Finding                                                                                                                                                                                                                                                                                          | Location                                                                            | Fix                                                                                                                                                                                 |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | 🟠  | Office earnings are attributed via the courier's **current** office (`INNER JOIN couriers c … c.delivery_office_id = ?`), not the office that handled the delivery. If a courier moves office or turns freelance, history moves with them. `ON DELETE SET NULL` on offices also orphans history. | `delivery-office-settlement.service.ts` `getPendingEarnings`, `createSettlement`    | Filter on `d.delivery_office_id = ?` directly; drop the courier join.                                                                                                               |
| M2  | 🟠  | Admin "all offices" settlement (no `deliveryOfficeId`) puts **every** office's unsettled fees into one settlement with a NULL office.                                                                                                                                                            | `delivery-office-settlement.service.ts` `createSettlement`                          | Require `deliveryOfficeId`, or create one settlement per office in a loop. Exclude deliveries with `delivery_office_id IS NULL`.                                                    |
| M3  | 🟠  | The fee split is computed at delivery **creation** (`createIndividualDelivery`), before we know if an office or a freelancer will deliver. Every delivery carries an `office_fee_amount`.                                                                                                        | `delivery.service.ts` `createIndividualDelivery`                                    | Store only `delivery_fee` and the tier at creation. Compute `courier_fee_amount` / `office_fee_amount` / `platform_fee_amount` at **accept/claim time**, based on fulfillment type. |
| M4  | 🟠  | When a manager creates a courier settlement, the courier is checked against the office, but the delivery query only filters by `courier_id`. It includes deliveries the courier did for other offices or as a freelancer.                                                                        | `courier-settlement.service.ts` `createSettlement`, `getAllCouriersPendingEarnings` | For MANAGER, add `AND d.delivery_office_id = <myOffice>`. For freelance, `AND d.delivery_office_id IS NULL`.                                                                        |
| M5  | 🟠  | Platform overview `totalPendingPayouts` sums `total_price` (goods value), not `courier_fee_amount`.                                                                                                                                                                                              | `courier-settlement.repository.ts` `getPlatformOverview`                            | Use `SUM(courier_fee_amount)`. Also expose office pending and platform revenue. `/overview` route comment says admin-only but allows MANAGER.                                       |
| M6  | 🟠  | Settlement creation selects deliveries without row locks; two concurrent settlements for the same courier/office can include the same deliveries.                                                                                                                                                | both settlement services                                                            | `SELECT … FOR UPDATE` in the transaction, and make `markDeliveriesAs*Settled` update `WHERE … AND *_settlement_id IS NULL` and check `affectedRows`.                                |
| M7  | 🟠  | **Cash on delivery isn't tracked.** If couriers collect cash from customers, nothing records how much cash each courier holds or nets it against payouts. Offices absorb this risk today; freelancers have no guarantor.                                                                         | (missing)                                                                           | See §3.6. Needs a product decision (Q3).                                                                                                                                            |
| M8  | 🟡  | `courier_settlements.courier_id` FK is `ON DELETE CASCADE`. Deleting a courier deletes financial records.                                                                                                                                                                                        | `schema.sql`                                                                        | Change to `RESTRICT`; couriers should be deactivated, never deleted.                                                                                                                |

---

## 3. Freelance couriers — design

### 3.1 Schema changes

```sql
ALTER TABLE couriers
  ADD COLUMN courier_type ENUM('OFFICE','FREELANCE') NOT NULL DEFAULT 'OFFICE',
  ADD COLUMN approval_status ENUM('PENDING_REVIEW','APPROVED','SUSPENDED') NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN national_id_media_id VARCHAR(36) NULL,
  ADD COLUMN license_media_id VARCHAR(36) NULL,
  ADD COLUMN last_latitude DECIMAL(10,8) NULL,
  ADD COLUMN last_longitude DECIMAL(11,8) NULL,
  ADD COLUMN last_seen_at TIMESTAMP NULL,
  ADD COLUMN cancellation_count INT NOT NULL DEFAULT 0,
  ADD INDEX idx_type_available (courier_type, is_available, is_active, approval_status);

ALTER TABLE deliveries
  ADD COLUMN fulfillment_type ENUM('OFFICE','FREELANCE') NULL,   -- set on accept/claim
  ADD COLUMN fee_tier_id VARCHAR(36) NULL,                         -- snapshot at creation
  ADD COLUMN platform_fee_amount DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN open_to_freelance_at TIMESTAMP NULL,                  -- office-first window end
  ADD INDEX idx_freelance_pool (status, delivery_office_id, courier_id, open_to_freelance_at);

ALTER TABLE delivery_fee_tiers
  ADD COLUMN freelance_courier_percentage DECIMAL(5,2) NULL,
  ADD COLUMN freelance_platform_percentage DECIMAL(5,2) NULL;      -- must sum to 100 when set
```

- `courier_type` is explicit. **Do not** infer "freelance" from `delivery_office_id IS NULL`, because `ON DELETE SET NULL` would silently turn office couriers into freelancers.
- Consider changing `couriers.delivery_office_id` FK to `RESTRICT` and deactivating offices instead of deleting them.
- Rule: `courier_type = 'FREELANCE'` ⇔ `delivery_office_id IS NULL` (enforce in the service layer).

### 3.2 State machine

```
PENDING ─┬─ office accepts ─→ ACCEPTED ─ office assigns ─→ ASSIGNED ─┐
         │                                                           ├→ PICKED_UP → ON_THE_WAY → DELIVERED
         └─ freelancer claims (atomic) ──────────────────→ ASSIGNED ─┘
```

Freelancer claim, as one atomic statement:

```sql
UPDATE deliveries
   SET courier_id = ?, status = 'ASSIGNED', fulfillment_type = 'FREELANCE', assigned_at = NOW(),
       courier_fee_amount = ?, office_fee_amount = 0, platform_fee_amount = ?
 WHERE id = ? AND status = 'PENDING' AND delivery_office_id IS NULL AND courier_id IS NULL
   AND (open_to_freelance_at IS NULL OR open_to_freelance_at <= NOW());
```

In the same transaction: the courier must be `FREELANCE`, `APPROVED`, `is_active`, `is_available` (lock the row with `FOR UPDATE`), then set `is_available = FALSE`.
After commit: cancel the acceptance SLA, schedule the pickup SLA, and publish `COURIER_ASSIGNED` (with `fulfillmentType`).

Office accept also sets `fulfillment_type = 'OFFICE'` and computes the office split (fixes M3).

SLA and cancellation by fulfillment type:

| Event                      | OFFICE                                                      | FREELANCE                                                                               |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Acceptance SLA expires     | FAILED (unchanged)                                          | FAILED (unchanged)                                                                      |
| Assignment SLA expires     | → PENDING, clear office, **reschedule acceptance SLA** (F2) | n/a (claim goes straight to ASSIGNED)                                                   |
| Pickup SLA expires         | → ACCEPTED, clear courier, reschedule assignment SLA (F3)   | → PENDING, clear courier, reset fees, reschedule acceptance SLA, `cancellation_count++` |
| Courier cancels (ASSIGNED) | → ACCEPTED, notify office (F4)                              | → PENDING, back to the pool, `cancellation_count++`                                     |

### 3.3 Dispatch policy

Config (env, later admin-editable):

- `FREELANCE_ENABLED` (bool)
- `OFFICE_PRIORITY_WINDOW_MINS` — at creation, `open_to_freelance_at = created_at + window`. 0 = everyone at once. If no office remains, set it to 0.
- `FREELANCE_RADIUS_KM` — only show/notify freelancers whose `last_lat/lng` is within radius of the first pickup.

New endpoints:

- `GET  /deliveries/freelance/available` (COURIER, freelance + approved) — the pool, filtered by window and radius, **without** customer phone.
- `PATCH /deliveries/:id/claim` (COURIER, freelance + approved).
- `PATCH /couriers/me/location` (COURIER) — heartbeat.
- `PATCH /couriers/:id/approval` (ADMIN) — approve or suspend.
- `PATCH /couriers/:id/deactivate` (ADMIN, and MANAGER for own office) — F6.

Registration: freelancers self-register from the Courier app (`approval_status = PENDING_REVIEW`, docs via media-service), or admin creates them with `courierType = FREELANCE`.

### 3.4 Fees

- At creation, store `delivery_fee` and `fee_tier_id` only.
- On office accept: `courier = fee × courier%`, `office = fee × office%`, `platform = fee × platform%`.
- On freelance claim: `courier = fee × freelance_courier%`, `office = 0`, `platform = fee × freelance_platform%`. If the tier has no freelance values, fall back to `courier% + office%` for the courier (decision Q2).
- Validate the freelance percentages in `DeliveryFeeTierService.validate` (both set or both null, sum = 100).
- Backfill existing rows: `fulfillment_type = 'OFFICE'` where `delivery_office_id IS NOT NULL`; recompute `platform_fee_amount`.

### 3.5 Settlements

- **Office settlements:** filter by `d.delivery_office_id` (M1), one per office (M2), only `fulfillment_type = 'OFFICE'`.
- **Courier settlements:**
  - MANAGER: only their office's couriers **and** `d.delivery_office_id = myOffice` (M4).
  - ADMIN: can settle anyone. For freelancers this is the only path; managers get `UnauthorizedError` for freelance couriers.
  - Freelance pending earnings: `courier_id = ? AND fulfillment_type = 'FREELANCE'`.
- **Admin overview:** pending courier payouts (split office/freelance), pending office payouts, platform revenue (`SUM(platform_fee_amount)`) (M5).
- Locking and idempotency per M6.

### 3.6 Cash on delivery (if applicable — decision Q3)

```sql
ALTER TABLE deliveries ADD COLUMN cash_collected_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE courier_settlements
  ADD COLUMN total_cash_collected DECIMAL(10,2) DEFAULT 0.00;  -- net_payout = fees - cash held
```

- On DELIVERED for a cash order, record `cash_collected_amount = order total`.
- Courier settlement: `net_payout = total_delivery_fees - total_cash_collected`. Negative means the courier owes the platform.
- Optional: a `FREELANCE_MAX_CASH_HELD` cap. A freelancer above the cap can't claim until settled.

### 3.7 Notifications / realtime

- `websocket-gateway`:
  - On connect, freelancers join `courier:freelance`, and managers join `office:<id>` (S6).
  - Broadcast "new pool delivery" to `courier:freelance` when `open_to_freelance_at` passes.
  - Use a delayed BullMQ job `freelance_open` at the window end, alongside the existing SLA jobs.
- `notification-service`:
  - Push to approved, available freelancers within radius on `DELIVERY_OPEN_TO_FREELANCE` (new `EventType`).
  - On approve/suspend, notify the courier.
- `DeliveryPublisher` adds: `publishDeliveryOpenToFreelance`, `publishDeliveryClaimed`, and `publishDeliveryReturnedToPool`.

### 3.8 Apps / dashboards

- **Courier mobile app (gitignored, `mobile/Courier`):**
  - freelance onboarding (docs upload, pending-review screen);
  - "Available jobs" tab and claim button;
  - location heartbeat while available;
  - earnings and settlements screen (already exists; verify it works for freelancers).
- **Admin dashboard (`web/admin-dashboard`):**
  - freelancers list with approval/suspend actions;
  - freelance fee percentages on fee tiers;
  - freelance settlements;
  - updated overview;
  - dispatch settings.
- **Delivery dashboard and Delivery mobile app (`web/delivery-dashboard, mobile/Delivery`):** managers should only see their own office's couriers and deliveries. No other change.

---

## 4. Implementation plan

### Phase 1 — Security fixes (do first, small and independent)

- [x] S1 ownership check in `updateDeliveryStatus`
- [x] S2 ownership on courier update/availability
- [x] S3 ownership on `GET /deliveries/:id`
- [x] S4 scope `getAvailableCouriers` / `getAllCouriers` / `getAllDeliveries`; no fallback to everything
- [x] S5 courier office/active/available check + row lock in `assignCourier`
- [x] S6 office-scoped socket rooms
- [x] S7 validate user role on courier registration

### Phase 2 — Flow & money bugs

- [x] F1 link couriers to the creating manager's office (+ admin `deliveryOfficeId`). No backfill script: DB is reset and `seed-db.ts` already links seeded couriers
- [x] F2 reschedule acceptance SLA after assignment expiry
- [x] F3 clear courier + reschedule assignment SLA after pickup expiry
- [x] F4 courier cancel → reassign instead of FAILED
- [x] F6 add `/couriers/:id/deactivate`
- [x] F5, F7, F8, F9 cleanups
- [x] M1, M2 office settlement attribution
- [x] M4 manager courier-settlement scoping
- [x] M5 platform overview numbers
- [x] M6 settlement locking / idempotency
- [x] M8 FK `ON DELETE` changes

### Phase 3 — Freelance couriers

- [x] Schema (§3.1) — applied directly in `schema.sql` (DB reset, no migration/backfill). Seed adds two freelancers (Sami approved, Tamer pending) and freelance tier splits
- [x] M3 move fee split to accept/claim time (§3.4) + fee tier freelance percentages
- [x] Courier type/approval, self-registration, admin approve/suspend
- [x] Pool endpoint + atomic claim + location heartbeat (§3.3)
- [x] SLA handling per fulfillment type (§3.2 table)
- [x] Office-priority window job + events
- [x] Freelance settlements + admin overview (§3.5)
- [x] Cash tracking (§3.6) — if Q3 = yes
- [x] Notifications / websocket (§3.7)
- [x] Admin dashboard UI (§3.8): couriers page filters (office / freelance / pending review), approve/suspend, type + office on create; fee tier freelance split; financials overview strip + freelancer cash card
- [x] Courier app (§3.8): Jobs tab (freelancers only) with claim, location heartbeat (`@react-native-community/geolocation`, permissions added), approval banner, "I can't deliver this" (release) button
- [x] Courier app freelancer self-signup (2026-10-09): Signup (COURIER account) → Onboarding (name, phone, vehicle, plate, ID + license photos via `react-native-image-picker`) → Application status (pending / suspended, live via `COURIER_APPROVAL_UPDATED`). A gate in `RootNavigator` picks the screen from `/couriers/me` (404 = onboarding). Media-service lets COURIER upload only to `courier-documents` with a server-generated path; couriers store document URLs (`national_id_url`, `license_url`); license optional for bicycles only. Admin couriers page links the documents. ⚠️ The R2 bucket is public: paths are unguessable, but ID photos should move to private storage with signed URLs.
- [x] Courier app deliveries (2026-10-09): compact list with Active/History tabs + `DeliveryDetailsScreen` (route with Google Maps directions, call customer, items, cash to collect, next-status action with confirm, report customer problem, release).
- [x] Load-test scenario for concurrent claims (`load-tests/`)

---

## 5. Decisions (defaults applied 2026-10-08)

Q1 = (a), `OFFICE_PRIORITY_WINDOW_MINS` (default 2). Q2 = to courier unless the tier sets freelance percentages. Q3 = **yes** — order-service has no payment step, so every order is cash on delivery; `cash_collected_amount = total_price + delivery_fee` on DELIVERED, netted only in admin freelance settlements (office cash stays between office and courier, as before). Q4 = separate groups. All four can still be changed; original options below.

| #   | Question                                                                  | Options                                                                                   | Default if unanswered                                                            |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Q1  | Dispatch priority                                                         | (a) offices first for N minutes, then freelancers · (b) everyone at once · (c) zone-based | (a), configurable N                                                              |
| Q2  | Freelance fee split: where does the office share go?                      | to courier · to platform · split                                                          | to courier (`courier% + office%`), unless the tier defines freelance percentages |
| Q3  | Do couriers collect cash from customers? Track and net it in settlements? | yes / no                                                                                  | yes — implement §3.6                                                             |
| Q4  | Can office couriers also claim freelance jobs?                            | separate groups · allowed when idle                                                       | separate groups                                                                  |

---

## 6. Implementation notes (2026-10-08)

- **Config** (`services/delivery-service/src/config/env.ts`, also in `docker-compose.yml`): `FREELANCE_ENABLED` (default `false`), `OFFICE_PRIORITY_WINDOW_MINS` (2), `FREELANCE_RADIUS_KM` (5, 0 = off), `FREELANCE_MAX_CASH_HELD` (2000 EGP, 0 = off), `COURIER_LOCATION_STALE_MINUTES` (10). When freelance is on, the acceptance SLA is extended by the office window so freelancers still get a full window.
- **New endpoints:** `POST /couriers/freelance/register`, `PATCH /couriers/me/availability`, `PATCH /couriers/me/location`, `PATCH /couriers/:id/deactivate`, `PATCH /couriers/:id/approval`, `GET /deliveries/freelance/available`, `PATCH /deliveries/:id/claim`, `PATCH /deliveries/:id/release`, `GET /delivery-offices/me`. Admin-service proxies: `PATCH /admin/couriers/:id/approval`, `PATCH /admin/couriers/:id/deactivate` (the dashboard already called PATCH; only POST existed), `GET /admin/delivery-settlements/courier/all-pending`, `GET /admin/delivery-settlements/overview`.
- **Restricted:** `GET /deliveries/pending` is ADMIN/MANAGER only (Courier app never used it); `GET /couriers/available` no longer allows COURIER; `PATCH /deliveries/:id/status` can't set ACCEPTED/ASSIGNED, and only ADMIN can set FAILED; `/courier-settlements/overview` is ADMIN only; `/courier-settlements/courier/:id/pending` checks ownership.
- **New events:** `DELIVERY_RELEASED_BY_COURIER`, `DELIVERY_OPEN_TO_FREELANCE`, `DELIVERY_CLAIMED`, `DELIVERY_RETURNED_TO_POOL`, `COURIER_APPROVAL_UPDATED`; new BullMQ job type `freelance_open`.
- **SLA queue fix:** completed jobs are kept (`removeOnComplete: 100`), and BullMQ ignores `add()` for an existing job id, so a re-scheduled SLA (F2/F3) would silently never fire. `DeliverySlaManager.enqueue` removes the old job first. SLA worker now publishes/reschedules after commit (rescheduling inside the transaction would block on its own row lock).
- **Load tests:** `scripts/seed.ts` spreads couriers across offices and records `officeEmail`; `order-lifecycle` assigns via the courier's own office (S5 would otherwise reject 2/3 of runs). New `npm run loadtest:prepare-freelance-race` + `loadtest:freelance-race` (needs `FREELANCE_ENABLED=true OFFICE_PRIORITY_WINDOW_MINS=0`).

### Found along the way, not fixed (outside this plan)

How to fix (proposed 2026-10-09, not applied yet):
1. **Register as ADMIN.** Only CUSTOMER, VENDOR and COURIER can self-register. Every caller of the public `/auth/register` uses one of those three (customer web + app, vendor dashboard, Courier app, load tests). ADMIN and DELIVERY_MANAGER need a service token, which is how admin-service already creates accounts. Put `authenticate` + `authorize(ADMIN)` on `/users`, `/users/count`, `/users/:id` and `/users/:id/status`; service tokens pass `authorize`, so admin-service and delivery-service keep working.
2. **Split deliveries, full fee each.** The customer pays one fee, computed from the farthest store (`DeliveryFeeCalculator`). When `createDeliveryFromOrder` splits the order, divide that fee across the deliveries so they add up to exactly what the customer paid (rounding remainder on the last one). Weight the shares by each store's distance to the customer, or split equally. Fee split and cash then follow automatically.
3. **user-service deactivate without auth.** `UserServiceClient.deactivateCourier` / `getAllCouriers` have no callers, so delete them instead of adding auth.

| Sev | Finding | Where |
| --- | --- | --- |
| 🔴 | Public `POST /auth/register` accepts **any** role, including `ADMIN`. Anyone can create an admin account. Also `/users`, `/users/:id`, `/users/:id/status` on auth-service have no `authenticate`. | `auth-service` `auth.service.ts` `register`, `auth.routes.ts` |
| 🟠 | When vendors are far apart the order is split into several deliveries, and **each** gets the full order `delivery_fee` (courier/office fees and now cash are counted once per delivery). | `delivery.service.ts` `createDeliveryFromOrder` → `createIndividualDelivery` |
| 🟡 | `user-service` calls `PATCH /couriers/:id/deactivate` with no auth header, so it always gets 401. | `user-service/src/infrastructure/http/service-client.ts` |
| ✅ | ~~The Courier app's "Cancel Delivery" button sat next to "I can't deliver this".~~ Fixed 2026-10-09: the details screen labels it "Report a customer problem". | `mobile/Courier/src/screens/DeliveryDetailsScreen.tsx` |

---

## 7. Phase 4 — Customer sees and calls the courier (implemented 2026-10-09)

Built as `GET /delivery/deliveries/by-order/:customerOrderId/couriers` (CUSTOMER; returns `[]` before the order is ready, 404 for someone else's order). Customer mobile app: `CourierCard` on `OrderDetailsScreen`; web: `CourierSection` on `OrderDetailsPage`. Courier-change push (`notification_courier_changed_*`) is sent to the customer only when a courier who held the order is removed.

Goal: on the Customer app order details screen, show the courier delivering each part of the order (name, vehicle, photo/rating later) with a **Call** button, from assignment until delivery.

**Backend (delivery-service)**

- [x] `GET /deliveries/by-order/:customerOrderId/courier` — role `CUSTOMER`. Load `findByCustomerOrderId`, require `delivery.customerId === req.user.userId` (else 404), and return one entry per delivery: `{ deliveryId, status, courierName, courierPhone, vehicleType, licensePlate, fulfillmentType }`.
- [x] Only expose the courier while it matters: status `ASSIGNED`, `PICKED_UP` or `ON_THE_WAY`. Before that there's no courier; after `DELIVERED`/`FAILED` hide the phone (privacy for the courier).
- [x] The repository already joins `c.full_name, c.phone` as `courierName/courierPhone`; add `c.vehicle_type` to that join.
- [x] Route through the gateway like the other `/delivery/*` calls (no gateway change needed if the prefix is already proxied).
- [ ] Optional later: number masking (a call-proxy / virtual number provider) so neither side sees the other's real number — the doc's S3 concern in reverse. Start with the real number, as the courier already sees the customer's.

**Realtime**

- [x] `COURIER_ASSIGNED` already reaches `user:<customerId>`. Also make the Customer app refetch on `DELIVERY_RETURNED_TO_POOL`, `DELIVERY_RELEASED_BY_COURIER` and `SLA_COURIER_PICKUP_EXPIRED` (courier changed or removed). The gateway must keep `customerId` on those payloads for the customer room — `DELIVERY_RELEASED_BY_COURIER` and `DELIVERY_RETURNED_TO_POOL` don't carry it yet; add `customerId` there (the gateway's slim office/freelancer broadcast already strips it for those rooms).

**Customer app (`mobile/Customer`)**

- [x] `DeliveryService.getOrderCouriers(orderId)` in `src/services/api`.
- [x] In `useOrderDetails`, a second `useQuery(['order-couriers', orderId])`, enabled when the order status is `READY`/`PICKED_UP`/`IN_DELIVERY`; add the events above to `socketEvents`.
- [x] `CourierCard` component on `OrderDetailsScreen`: name, vehicle + plate, status line ("on the way to the store" / "on the way to you"), and a Call button → `Linking.openURL('tel:' + phone)` (same pattern as the Courier app's call-customer button). One card per delivery when the order was split.
- [x] Translations (ar/en) and `AppText` from `@city-market/mobile-ui`.
- [x] Same card on `web/customer` order page (optional).
