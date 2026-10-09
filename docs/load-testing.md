# Load Testing — Running Against Each Environment

The load-test suite lives in `load-tests/` (Artillery + TypeScript processors).
See `load-tests/README.md` for the full tier list; this doc covers **where** to
point it and how to read a smoke run.

## How targeting works

| Piece | Reads target from | Notes |
|---|---|---|
| `npm run loadtest:<tier>` (Artillery) | `--env <name>` → `load-tests/config/environments.yml` | default env is `local` |
| `npm run loadtest:seed` / `loadtest:cleanup` | `BASE_URL` in `load-tests/.env` (or shell env) | **ignores `--env`** |

- Every target must end in `/api/v1`.
- `scripts/lib/safety.ts` refuses any non-localhost target unless
  `ALLOW_PRODUCTION_LOAD_TEST=true`.
- **Seeding writes `load-tests/data/generated/*.csv`.** Those CSVs hold IDs from
  the database that was seeded. Each environment has its own DB, so **re-seed
  every time you switch environment**, otherwise scenarios log in with accounts
  that don't exist there (`invalid_credentials`) and browse a vendor with no
  products.

## 1. Local dev — isolated load-test stack (`npm run dev:loadtest`)

`api-gateway` listens on `:3000` and proxies to the services. DBs are the host
MySQL on `:3306`. This is the `local` environment (default).

`npm run dev:loadtest` starts the backend services only (no web dashboards). It
starts the gateway with `RATE_LIMIT_MAX_REQUESTS=1000000`. The gateway's normal
limit is 100 req/min **per IP**, and a load generator sends every simulated user
from a single IP, so plain `npm run dev` caps any test at ~100 requests/min. That
cap was the cause of the mass `429`s in the 2026-10-02 baseline runs. The override
only applies outside production: `api-gateway/src/app.ts` ignores it when
`NODE_ENV=production`. Production protection is nginx, which isn't touched.

```bash
# terminal 1 (repo root)
npm run dev:loadtest
curl http://localhost:3000/health   # {"status":"healthy","service":"api-gateway"}

# terminal 2
cd load-tests
BASE_URL=http://localhost:3000/api/v1 SEED_REQUEST_DELAY_MS=20 npm run loadtest:seed
npm run loadtest:smoke
npm run loadtest:baseline
```

Run `baseline` / `stress` / `spike` / `soak` here.

## 2. Local Docker — nginx (same topology as the VPS)

The docker stack has **no api-gateway container**: nginx (`nginx/nginx.conf`)
routes `/api/v1/*` straight to each service and is published on `:80`. DBs are
the container MySQL on host port `:3307` — a different database from dev.
This is the `local-nginx` environment.

```bash
# stop `npm run dev` first
npm run docker:up
curl -i http://localhost/api/v1/catalog/categories   # expect 200

cd load-tests
BASE_URL=http://localhost/api/v1 SEED_REQUEST_DELAY_MS=6500 npm run loadtest:seed
npm run loadtest:smoke -- --env local-nginx
```

nginx rate limits are **per client IP**:

| Zone | Locations | Rate | Burst |
|---|---|---|---|
| `auth` | `/api/v1/auth` | 10 req/min | 20 |
| `api` | other `/api/v1/*` | 60 req/min | 30 (media/payments less) |

`smoke` (8 VUs total) fits under this. Heavier tiers from one machine will mostly
get **429** — that measures nginx, not the services. For heavier tiers use
api-gateway (section 1), or temporarily raise the limits in a local copy of
`nginx.conf`.

## 3. VPS (production)

Same nginx + docker topology as section 2, fronted by the real domain.

1. Set the `production` target in `load-tests/config/environments.yml` to
   `https://citymarket.tech/api/v1` (`http://` if the VPS was built without
   `DOMAIN`, i.e. without `nginx.ssl.conf`).
2. Opt in **for that single command only** — never leave it `true` in `.env`:

```bash
cd load-tests
ALLOW_PRODUCTION_LOAD_TEST=true BASE_URL=https://citymarket.tech/api/v1 \
  SEED_REQUEST_DELAY_MS=6500 npm run loadtest:seed
ALLOW_PRODUCTION_LOAD_TEST=true npm run loadtest:smoke -- --env production
ALLOW_PRODUCTION_LOAD_TEST=true BASE_URL=https://citymarket.tech/api/v1 \
  npm run loadtest:cleanup
```

Rules for production:
- **Smoke only.** Anything heavier affects real users and hits the rate limits.
- Smoke writes real rows (`loadtest_*` customers, orders). Always run
  `loadtest:cleanup` afterwards.
- The delivery-manager accounts and password default to the dev seed
  (`deliverymanager@citymarket.com` / `password123`). Set
  `DELIVERY_MANAGER_EMAILS` and `SEED_ACCOUNTS_PASSWORD` to valid production
  accounts, or that scenario fails.
- The auth rate limit is per IP. Running from your own IP can briefly throttle
  your own dashboard logins.

## Quick reference

| Target | Start | Seed `BASE_URL` | Run |
|---|---|---|---|
| api-gateway (dev) | `npm run dev:loadtest` | `http://localhost:3000/api/v1` | `npm run loadtest:smoke` |
| Docker + nginx | `npm run docker:up` | `http://localhost/api/v1` | `npm run loadtest:smoke -- --env local-nginx` |
| VPS | already running | `https://citymarket.tech/api/v1` | `ALLOW_PRODUCTION_LOAD_TEST=true npm run loadtest:smoke -- --env production` |

## Reading a run

Every run ends with a summary box and writes `reports/<tier>-<timestamp>.md`.
That file is the report to read: overview, key results, thresholds, status
codes, per-endpoint and per-scenario tables, detected problems,
recommendations, and a final **PASS/FAIL** (see load-tests/README.md "Reports").
A run is **invalid**, so FAIL regardless of latency, if it saw any `429`,
skipped orders for lack of test data, or (baseline) held fewer than 40 or more
than 60 concurrent sessions.

| Symptom in output | Meaning | Fix |
|---|---|---|
| `connect ECONNREFUSED 127.0.0.1:3000` | Nothing listening on the target | Start the stack; check `/health` |
| `POST /auth/login` 401 + `Failed capture or match` | CSV accounts are from another DB | Re-seed against this target |
| `order.create.skipped_no_product` | No orderable product on the vendor listing or in vendor-products.csv | Re-seed against this target |
| Server log `customer_not_found` | Orders from customers seeded before 2026-10-02 (no user-service profile). The seed now creates the profile | Re-seed customers |
| Many `429` | nginx limit, or gateway started with plain `npm run dev` | Use `npm run dev:loadtest` |
| `500` + server log `Too many connections` | MySQL connection budget exhausted (see results log below) | App-side fix needed |

## Smoke results log

### 2026-09-24 — local api-gateway (`npm run dev`)

**Run 1 — FAIL (not a real test).** All 8 VUs got `ECONNREFUSED`; the dev stack
wasn't running. No request reached the API.

**Run 2 — FAIL (`maxErrorRate`), latency OK.**
Report: `load-tests/reports/smoke-2026-09-24T14-15-48-558Z.json`

| Metric | Value |
|---|---|
| Requests | 16 (11× 200, 5× 400) |
| VUs | 8 created, 6 completed, 2 failed |
| p95 / max response time | 71.5 ms / 172 ms ✅ |
| Register p95 | 194 ms |
| Error rate | 7/21 operations (5× 400 order, 2× vendor-login 401) ❌ |

Per scenario:
- **Customer (5 VUs)** — register ✅, categories ✅, vendor products ✅ (200 but
  empty), create order ❌ 400 `order_must_have_at_least_one_item`, because no
  product was available so the processor sent `items: []`.
- **Vendor (2 VUs)** — login ❌ 401 `invalid_credentials`.
- **Delivery office (1 VU)** — login ✅, pending deliveries ✅.

Root cause (verified in the dev MySQL on `:3306`): `data/generated/*.csv` came
from a 2026-09-13 seed against a **different database**. The vendor
`loadtest_vendor_88bdb25f@loadtest.local` doesn't exist, and pool vendor
`a50bb6c2-…` has 0 products. The delivery-manager accounts do exist, which is
why that scenario passed. Both failures are test-data problems, not API bugs.

Server side: every order request also logged `customer_not_found` (404) from
user-service during the COD penalty check. This is expected for smoke customers
(see table above) and didn't cause the 400.

**Re-seeding then failed too**, and smoke kept using the old CSVs: the seed died
with `POST /catalog/products/vendor/:id/bulk-add-global failed: 400 items_required`
*before* writing `vendors.csv` / `vendor-products.csv` (only `customers.csv` had
been rewritten). Cause: the dev catalog has only 2 global products, both in the
بقالة category, and the seed gave vendor #1 the first category (ألبان, 0
products) → empty `items`. `assertGlobalProductsExist()` didn't catch it because
it only checks the global total is > 0. **Fixed in `scripts/seed.ts`**: each
vendor now rotates through categories until one has global products.

**Run 3 (after fixed seed) — PASS.**
Report: `load-tests/reports/smoke-2026-09-24T14-27-21-710Z.json`

| Metric | Value |
|---|---|
| Requests | 21 (15× 200, 6× 201), 0 errors |
| VUs | 8 created, 8 completed, 0 failed |
| p95 / median response time | 104.6 ms / 13.1 ms ✅ |
| Register p95 / login p95 | 153 ms / 133 ms |
| Checks | `maxErrorRate < 5` ok, `p95 < 1000` ok |

Caveat: dev has only 2 global products, so every seeded vendor has ≤ 2 products.
That's fine for smoke, but heavier tiers will hit the same few rows (stock
contention). Import more global products (`npm run db:import-global-products`)
before baseline or stress.

### Troubleshooting the seed

- Always check the seed ends with `Done. Generated data written to …`. If it
  aborts, only the CSVs written before the failure are refreshed, and the rest
  are stale.
- `load-tests/.env` has `BASE_URL=http://localhost/api/v1` (nginx on :80). For
  the dev stack, pass `BASE_URL=http://localhost:3000/api/v1` explicitly or
  change it in `.env`.

## Baseline results log

### 2026-10-02 — before the fixes (13:20, 16:52 UTC runs)

**Not a valid test.** 1500 VUs created, but 1316 failed: 1188 at
`register_failed(customer): 429`, plus 128 pooled logins also 429. Only ~490
requests were tracked. Causes: every VU registered a new account, and
api-gateway's 100 req/min/IP limiter capped the whole run at ~500 requests in 5
minutes (only 489 requests were tracked; auth calls ran outside Artillery's stats). `skipped_no_product` came from the vendor-product listing request being
429'd, which left the order flow with no product.

### 2026-10-02 — after the fixes (local, `npm run dev:loadtest`)

Setup changes: pooled logins (no registration), customer profiles seeded,
stock sized for repeated runs, rebalanced delivery-office persona, 30s warm-up.

| Run | Concurrency (avg) | Requests | Error rate | p50 / p95 / p99 | Result |
|---|---|---|---|---|---|
| 17:21 UTC | 49.4 | 7068 (20.8/s) | 0.08% (3x 500, 3x 400) | 9 / 198 / 392 ms | PASS |
| 17:31 UTC | 28.4 | 4683 | 16.7% (768x 500) | 12 / 191 / 384 ms | FAIL (invalid: concurrency) |
| 17:40 UTC | 44.7 | 6582 (19.3/s) | 5.24% (344x 500) | 9 / 180 / 308 ms | **FAIL (valid run)** |

Report: `load-tests/reports/baseline-2026-10-02T17-40-48-006Z.md`

Latency is well inside the SLO. **The failures are all MySQL `Too many
connections`**, a real bottleneck the baseline found. The suite isn't the cause:

1. **Connection budget.** Each service's pool allows 50 connections
   (`shared/src/node/database/database.ts`, `DB_CONNECTION_LIMIT` default) and
   never releases idle ones, across ~10 services. MySQL's `max_connections` is
   151, both on the host and in the docker-compose MySQL (production). During
   the run, delivery, order, user and vendor held ~35 connections each, which
   left catalog and auth starved (2-3 each). That's why `POST /auth/login` and
   catalog reads failed even though they're cheap. The connections stay held after
   the load stops, so the stack stays broken until restarted.
2. **`GET /delivery/deliveries/pending` fan-out.** Unpaginated, and it calls
   order-service + user-service for every row at once (`Promise.all`). That
   produced the bursts that grew those pools: ~45 pending rows meant ~90
   simultaneous internal requests per call.
3. **Stuck deliveries (bug).** `sla.worker.ts` handleAssignmentExpired reverts
   an ACCEPTED delivery to PENDING with `deliveryOfficeId: undefined`, but
   `deliveryRepo.update` skips undefined fields. The row stays PENDING with an
   office set: listed as pending forever, never acceptable
   (`delivery_already_accepted_by_another_office`), and it feeds the fan-out
   above. Reports count these as `delivery.pending.stale_office_set`.

Run 1 passed because the backlog of pending deliveries was still small. Run 2
grew it, because offices claimed ~25 deliveries per run against ~95 created. That
imbalance was fixed in the mix before run 3.

**Don't run normal-load/stress until these are fixed.** Baseline doesn't pass,
so higher tiers would only re-measure the same connection exhaustion.
