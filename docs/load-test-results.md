# Load Test Results — 2026-10-09

Every tier in `load-tests/` was run in sequence against the local dev stack
(`npm run dev:loadtest`). This file lists what each test does, what it measured,
the bugs it exposed and how they were fixed, and what still needs fixing (each
item there needs a decision before work starts).

Raw reports for every run are in `load-tests/reports/` (gitignored), named
`<tier>-<timestamp>.md`.

## Environment

| | |
|---|---|
| Machine | 1 laptop, 4 cores, 16 GB RAM. Runs all 12 services, MySQL, Redis, RabbitMQ **and** the Artillery load generator |
| Stack | `npm run dev:loadtest` (api-gateway on :3000 with the rate limit lifted, services via ts-node-dev) |
| Target | `local` → `http://localhost:3000/api/v1` |
| Test data | 300 customers, 20 vendors (431 orderable products), 20 couriers (all `APPROVED`), 3 delivery managers, 458 global products |

**Read the numbers with that in mind.** One 4-core box generating and serving the
load is far weaker than the VPS. The *bugs* found here are real anywhere; the
*capacity* numbers are only true for this machine.

### Test data check

The DB had been reset since the last seed, so the CSVs in `load-tests/data/generated/`
pointed at nothing (0 load-test users, 0 global products, 0 vendor products).

- Global products: 458 inserted with the catalog's own `ProductFactory`/`ProductSeeder`
  (`seed-db.ts` itself left unchanged — its product block stays commented out).
- `npm run loadtest:seed` re-run, then verified in MySQL: all accounts exist and are
  active; all 431 vendor products are `is_available=1` (the 99 with
  `stock_quantity=0` are WEIGHT products, stocked by `stock_weight_grams`); vendors
  are `CLOSED`, which order creation does not check.
- **Seed bug found:** couriers created by a delivery manager now start
  `PENDING_REVIEW` (office-courier review, commit c39e8bb), so every courier action
  failed with `courier_not_approved`. Fixed — `seed.ts` approves each courier as the
  seeded admin. Verified: 20/20 `APPROVED`.

## The tests, and what each one does

The five load tiers (baseline, normal-load, stress, spike, soak) all run the same
weighted scenario mix from `tests/_shared-scenarios.yml`; only the arrival rate
changes. Every session **logs in** first (`POST /auth/login`) as a pre-seeded account.

| Scenario (shared mix) | Weight | Steps |
|---|---:|---|
| Customer: Browse | 37 | login → categories → vendor list → vendor → vendor's products |
| Customer: Search | 18 | login → product search → categories → products in a category |
| Customer: Vendor + product detail | 14 | login → vendor list → vendor → vendor's products → one product |
| Customer: Place order | 20 | login → vendor's products → `POST /orders` → read the order back |
| Vendor: order management | 7 | login → vendor's orders → accept one PENDING order → mark CONFIRMED |
| Delivery office: claim | 3 | login → (pending deliveries → accept one) ×3 → available couriers |
| Courier: pickup | 1 | login → own profile → set available → my deliveries → mark PICKED_UP |

`arrivalRate` is **new sessions per second**, not users or requests. One session is
about 15 s long and makes 3–8 requests.

| Test | What it checks | Profile run | Result |
|---|---|---|---|
| smoke | Every persona can reach the API; registration works | 8 sessions total | ✅ PASS |
| baseline | Read-API SLO at ~50 concurrent sessions | 5/s for 5 min | ✅ PASS |
| normal-load | Where latency starts to climb | **scaled:** 30/s for 4 min (default 100→1000/s) | ❌ FAIL — login saturation |
| stress | Breaking point | **scaled:** 10→60/s in 10/s steps (default 1000→10000/s) | ⚠️ breaks at 30–40/s |
| spike | Survives a sudden burst and recovers | **scaled:** 10 → 60 → 10/s (default 50 → 500 → 50/s) | ⚠️ collapses during spike, recovers in ~20 s |
| soak | Stable over time (leaks, slow drift) | 8/s for 10 min (default) | ✅ PASS |
| order-lifecycle | One full journey per session: customer → vendor → office → courier → delivered | 1/s for 60 s (default) | ✅ PASS |
| concurrency-claim-race | 3 delivery offices accept the same delivery at once | default (3 racers) | ✅ PASS |
| freelance-claim-race | 3 offices + 5 freelancers take the same delivery at once | default (8 racers) | ✅ PASS |
| socket (connections) | 200 Socket.IO clients connect and hold for 60 s | 200 CUSTOMER sockets | ✅ PASS |
| socket (latency) | Time from `POST /orders` response to `VENDOR_ORDER_CREATED` on the vendor's socket | 20 vendors | ✅ PASS |

**Why stress, spike and normal-load were scaled down:** this machine's login ceiling
is ~52 logins/s (measured below), and every session logs in. The default profiles
start at 100–1000 new sessions/s, so they only measure a pile-up at the login
endpoint. The first default normal-load run proved it: every request in the first
phase timed out, and auth-service needed ~2.5 minutes to drain its backlog after
the run was stopped. The scaled profiles bracket the real breaking point instead.

## Results in detail

### smoke — PASS
96 requests, 0 failed, p95 125 ms. All personas, registration and order creation work.

### baseline — PASS
1,590 sessions, avg 49 concurrent (target 40–60). 7,191 requests, p50 7 ms,
p95 130 ms, p99 169 ms, 0.38% errors. The 27 errors are all
`delivery_already_accepted_by_another_office` — 3 offices racing for the same
delivery, which is the system working correctly.

### normal-load (scaled to 30/s) — FAIL
Final run, after every fix: avg 398 concurrent sessions, ~100 req/s, 1,351 orders
placed. 1,626 of 8,250 sessions failed, **all at `POST /auth/login`** (timeouts),
and login p50 was 8.7 s. Every other endpoint was healthy: `POST /orders` p95
1.35 s, catalog reads p95 ~320 ms, no 5xx.

30/s sits right at the login ceiling. Across 4 runs at this rate, failed sessions
ranged from 175 to 1,626 depending on what else the machine was doing. Treat
**20/s as the sustainable rate** on this box (see stress).

Before the fixes below, the same profile also hung order-service completely (pool
deadlock), and `GET /delivery/deliveries/pending` had p50 3.4 s.

### stress (10 → 60/s) — breaks at 30–40/s

| Rate | p95 | Failed sessions / 10 s |
|---|---|---|
| 10/s | 130–150 ms | 0 |
| 20/s | 160–175 ms | 0 |
| 30/s | climbs 0.7 s → 7 s | 7–9 |
| 40/s+ | — (mostly no successful responses) | 400–600 (everything) |

The only failing endpoint is `POST /auth/login`. Earlier stress runs also exposed
two bugs that are now fixed: RabbitMQ publish timeouts that lost events, and a
delivery-service pool deadlock.

### spike (10 → 60 → 10/s) — recovers in ~20 s
Steady 10/s: p95 ~140 ms. Spike to 60/s: login saturates within ~20 s and every
session fails for ~30 s. After the drop back to 10/s, p95 was back to 150–230 ms
within ~20 s. No service crashed or stayed degraded, and no DB pool got stuck.

### soak (8/s, 10 min) — PASS
4,800 sessions, avg 78 concurrent, 21,926 requests, p95 156 ms, p99 224 ms, 0.09%
errors. p95 stayed between 125 and 195 ms for all 10 minutes — no drift, no leak.
(Default 10-minute duration; the README suggests a 2 h run for real soak testing.)

### order-lifecycle — PASS
60 full journeys, 660 requests, 0 failed, p95 150 ms. Each journey: customer
orders → vendor accepts and confirms → office claims the delivery and assigns a
courier → courier marks PICKED_UP → ON_THE_WAY → DELIVERED → customer sees the
final state. A low-rate run ended with 20/20 orders `COMPLETED` in the DB.

### concurrency-claim-race — PASS
3 offices sent `PATCH /delivery/deliveries/:id/accept` on one delivery at the same
moment: 1 won (200), 2 got the expected 400. The DB shows exactly one office on it.

### freelance-claim-race — PASS
Run with delivery-service temporarily started with `OFFICE_PRIORITY_WINDOW_MINS=0`
(so freelancers can claim immediately), then restarted with normal settings. 3
offices + 5 freelancers raced: 1 winner (a freelancer), 7 expected 400s, no 5xx.
DB: `ASSIGNED`, `FREELANCE`, one courier, no office.

### socket — PASS
- Connections: 200/200 connected, connect time p50 10 ms / p95 33 ms, 0 failures.
- Latency: 20/20 `VENDOR_ORDER_CREATED` events received, p50 190 ms, p95 376 ms.

### Login capacity (measured separately)
300 logins straight to auth-service, with nothing else loading the machine:
**~52 logins/s** whether sent to auth directly or through the gateway (the gateway
adds no cost). That is bcrypt cost 10 (~70 ms of CPU each) on libuv's 4 worker
threads. Under the full mix, the other services take CPU away from it and the
effective ceiling drops to roughly 25–30/s.

## Bugs found and fixed

| # | Bug | Found by | Fix |
|---|---|---|---|
| 1 | **order-service locked up permanently.** `OrderCreationManager.create()` held a transaction connection while `getAllTiers()` asked the pool for another. With 10 orders mid-create, all of them waited forever; every DB request hung until a restart. | normal-load | All reads (catalog, vendor, commission tiers) happen before the transaction opens; only the writes run inside it. |
| 2 | **delivery-service locked up permanently** — same bug. `createDeliveryFromOrder` looked up the fee tier on the pool inside its transaction, and the RabbitMQ consumer runs `ORDER_READY` events with unlimited concurrency. Same pattern in assign-courier (`requireOffice`) and freelance claim (`requireCourier`, `computeFeeSplit`). | stress + spike | Reads moved before the transaction; fee-tier lookups accept the caller's connection. Re-run stress: pools stayed healthy. |
| 3 | **order-service published events before commit.** Consumers read orders that weren't committed yet (`order_not_found` in websocket-gateway), and deadlock retries sent duplicate events. | smoke logs | `after-commit.ts`: `OrderPublisher` queues events during a transaction and sends them only after commit (dropped on rollback). All 14 order-service transactions use it. |
| 4 | **RabbitMQ publish timeouts lost events.** Every publish made an `assertExchange` round trip with a 3 s timeout. Under load these timed out, and `POST /orders` returned 500 for orders that had been created. 17 orders are stuck in `DRAFT` because their `ORDER_STOCK_CHECK_REQUESTED` event was lost. | stress + spike | `shared` asserts the exchange once per channel. Re-run stress and spike: 0 publish timeouts. Order creation also no longer returns 500 after a successful commit (the failure is logged instead). |
| 5 | **`GET /delivery/deliveries/pending` was slow** (p50 3.4 s under load): one order-service call per row, for up to 50 rows. | normal-load | New service-only `POST /orders/customer-orders/batch`; delivery-service fetches all orders in one call. 60–115 ms idle, p50 0.4–0.5 s under load. |
| 6 | **Wrong cancellation reason.** Every `DELIVERY_FAILED` (acceptance timeout, office cancel, status FAILED) cancelled the order as "Delivery cancelled by courier". | DB audit | `DELIVERY_FAILED` now carries a `reason`. Verified: 878 orders now say "No delivery office accepted the order in time". |

### Load-test suite fixes

- `seed.ts` approves couriers as the admin (`ADMIN_EMAIL`, documented in `.env.example`).
- Vendor persona picks a random PENDING order instead of the first, so sessions
  sharing a vendor account stop colliding on the same order.
- `order-lifecycle.yml` hands out couriers in sequence. Random picks gave two
  in-flight journeys the same (busy) courier → `courier_not_available`.
- `prepare-claim-race` pages through the whole pending list. It used to read only
  page 1, so a new delivery behind a backlog was never found.
- `report.ts` gives `freelance-claim-race` the same error budget as the other
  claim race (7 losers out of 8 is the expected result, not a failure).

All changed packages typecheck (`order-service`, `delivery-service`, `shared`, `load-tests`).

## Needs fixing — decide before we do

Ordered by impact. None of these are done.

1. **Login is the capacity ceiling.** The whole system tops out at ~20–30 new
   sessions/s on this box because every login runs bcrypt on 4 threads. Options:
   run several auth-service instances (or node `cluster`) on the VPS; give auth its
   own CPU; or accept the limit, since real returning users refresh tokens (cheap)
   instead of logging in. The test mix logs in on every session, so it overstates
   login load — consider changing the test rather than the app. Next step: measure
   the same thing on the VPS before deciding.

2. **Lost events have no recovery (outbox).** Fix #4 removed the cause seen here,
   but if RabbitMQ is down or slow, events published after commit are logged and
   lost. The 17 `DRAFT` orders from this session prove what happens: the order
   exists, stock is never reserved, and it never moves. Options: a transactional
   outbox table (durable, more work), or a periodic sweeper that re-publishes
   `ORDER_STOCK_CHECK_REQUESTED` for DRAFT orders older than N minutes (simpler).
   The 17 stuck rows also need cleanup either way.

3. **RabbitMQ consumers have no prefetch limit.** A burst of events runs every
   handler at once, and that unbounded concurrency is what turned bug #2 into a
   full deadlock. Setting `channel.prefetch(N)` in `shared` bounds it. This changes
   throughput behavior for every service, so it should be tested before shipping.

4. **A delivery can bounce between offices forever.** If an office accepts but
   never assigns a courier, the assignment SLA returns the delivery to PENDING and
   **restarts the acceptance clock**, so it never fails. 218 deliveries were older
   than 15 minutes on a 5-minute SLA, still cycling. Decide on a cap (e.g. after N
   returns, fail the delivery or alert an admin).

5. **Offices fight over the same deliveries.** The pending list is the oldest 50,
   so all offices see the same rows and collide: 24% of accepts lost under
   normal-load. Options: a "claim next" endpoint, randomised ordering, or a
   per-office lock window.

6. **Customer orders cancelled with no reason.** When a vendor misses its
   confirmation SLA, the vendor order gets a reason, but the customer order is
   cancelled with `cancellation_reason = NULL` (6,471 orders here). Needs a product
   decision: which reason to show when several vendors fail differently.

7. **Security: `GET /orders/customer-orders/:id` has no ownership check.** Any
   logged-in user can read any order, including its address and items.

8. **auth-service `connect ETIMEDOUT` to MySQL under login load** (~150–180 per
   heavy run). `DB_HOST=localhost` resolves through the same libuv threads bcrypt
   is saturating. `DB_HOST=127.0.0.1` in auth's `.env` (or a larger
   `UV_THREADPOOL_SIZE`) should remove it. Env change, so not done.

9. **rating-service publishes before commit** (`RatingService.ts`), the same race
   as bug #3. Low traffic, low risk.

10. **Test suite.**
    - The helper scripts (seed, prepare-race, socket runner) read `BASE_URL` from
      `load-tests/.env`, which points at nginx on :80, while the Artillery tiers
      default to :3000. `prepare-race` and both socket tests failed with
      `ECONNREFUSED :80` until `BASE_URL=http://localhost:3000/api/v1` was exported.
      Point `.env` at :3000 or make the scripts honour `--env`.
    - The mix doesn't keep the pipeline flowing. Vendors confirm only ~1 in 3
      orders, so most orders end in vendor-SLA cancellation; offices never assign
      couriers, so the courier persona never has a delivery to pick up (45/45
      "none" in soak). Rebalance the weights or have offices assign.
    - The default stress/spike/normal-load profiles are 20–200× over what one
      machine can generate and serve. Add per-environment profiles.

## Reproduce

```bash
npm run dev:loadtest                                   # repo root
cd load-tests
export BASE_URL=http://localhost:3000/api/v1
SEED_REQUEST_DELAY_MS=20 npm run loadtest:seed -- --couriers 20
npm run loadtest:smoke
npm run loadtest:baseline
npm run loadtest:normal-load -- --phases '[{"duration":60,"arrivalRate":5,"rampTo":30},{"duration":240,"arrivalRate":30}]'
npm run loadtest:stress -- --phases '[{"duration":60,"arrivalRate":10},{"duration":60,"arrivalRate":20},{"duration":60,"arrivalRate":30},{"duration":60,"arrivalRate":40},{"duration":60,"arrivalRate":50},{"duration":60,"arrivalRate":60}]'
npm run loadtest:spike -- --phases '[{"duration":90,"arrivalRate":10},{"duration":15,"arrivalRate":10,"rampTo":60},{"duration":30,"arrivalRate":60},{"duration":15,"arrivalRate":60,"rampTo":10},{"duration":150,"arrivalRate":10}]'
npm run loadtest:soak
npm run loadtest:order-lifecycle
npm run loadtest:prepare-race && npm run loadtest:concurrency
npm run loadtest:socket -- --connections 200 --role CUSTOMER --duration 60
npm run loadtest:socket -- --mode latency --connections 20
# freelance race: start delivery-service with OFFICE_PRIORITY_WINDOW_MINS=0 first
npm run loadtest:prepare-freelance-race -- --freelancers 5 && npm run loadtest:freelance-race
```
