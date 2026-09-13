# CityMarket Load Testing

A dedicated, isolated load/performance-testing suite for the CityMarket
microservices platform, built on [Artillery](https://www.artillery.io/) 2.x plus
a small set of TypeScript scripts for anything Artillery doesn't fit well
(account seeding, Socket.IO, cleanup).

Every endpoint, DTO field, enum value, and event name referenced anywhere in this
suite was verified directly against the actual source code and, for the flows
that matter most, against a real running instance of the stack (see
"Validation" below) — nothing here is guessed.

## Contents

- [Architecture](#architecture)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Authentication](#authentication)
- [Test data](#test-data)
- [Traffic model](#traffic-model)
- [Running tests](#running-tests)
- [Performance thresholds](#performance-thresholds)
- [Reports](#reports--how-to-interpret-them)
- [Infrastructure monitoring](#infrastructure-monitoring)
- [Determining CityMarket's capacity](#determining-citymarkets-capacity)
- [Safety](#safety)
- [FAQ](#faq)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [CI/CD](#cicd)
- [Validation](#validation)

## Architecture

```
load-tests/
├── config/
│   └── environments.yml       target URLs per environment (config.environments)
├── processors/                 TypeScript hooks Artillery calls at runtime
│   ├── index.ts                 barrel - the ONE file every YAML config.processor points at
│   ├── auth.ts                  register/login, single-session-per-user handling
│   ├── data.ts                  order-payload/search-term/random-pick helpers
│   ├── correlation.ts           pick-the-right-record-from-a-list helpers
│   └── metrics.ts                custom counters for race-condition outcomes
├── scenarios/                  standalone, independently-runnable single-persona flows
│   ├── customer-browse.yml
│   ├── customer-search.yml
│   ├── customer-order.yml
│   ├── vendor.yml
│   ├── delivery-office.yml
│   └── courier.yml
├── tests/                      the actual test tiers
│   ├── _shared-scenarios.yml    the ONE weighted scenario mix, shared by 5 tiers below
│   ├── smoke.yml
│   ├── baseline.yml
│   ├── normal-load.yml
│   ├── stress.yml
│   ├── spike.yml
│   ├── soak.yml
│   ├── order-lifecycle.yml      full customer->vendor->delivery->courier journey
│   └── concurrency-claim-race.yml
├── scripts/
│   ├── lib/                    shared helpers (env, http, csv, safety) for the scripts below
│   ├── run-test.ts             orchestrator - what `npm run loadtest:*` actually calls
│   ├── seed.ts                 generates customers/vendors+products/couriers via the real APIs
│   ├── cleanup.ts               deactivates/deletes only what seed.ts created
│   ├── generate-users.ts       lighter-weight "just give me N accounts" helper
│   ├── prepare-claim-race.ts   sets up the one shared delivery concurrency-claim-race.yml races over
│   └── socket-load-runner.ts    dedicated Socket.IO load/latency runner (see below for why)
├── data/generated/              gitignored, written by the scripts above
└── reports/                     gitignored, written by every test run (-o flag)
```

### Deviations from a "standard" layout, and why

- **No `config/thresholds.yml` or `config/load-profiles.yml`.** Each tier's
  phases and thresholds are genuinely different (smoke is loose and forgiving,
  stress/spike/soak intentionally have no pass/fail gate at all - see
  [Performance thresholds](#performance-thresholds)), so extracting them into a
  shared file would just be indirection with nothing to share. They live inline
  in each `tests/<tier>.yml`, which is also where you override them.
- **`tests/_shared-scenarios.yml` is the only file with a top-level `scenarios:`
  key**, for baseline/normal-load/stress/spike/soak. This was **not** a
  stylistic choice - it's a hard constraint discovered empirically: Artillery
  merges multiple files' `scenarios:` arrays *index-by-index*, not by
  concatenating them, so two files each defining `scenarios[0]` silently
  corrupt each other's flow. `scripts/run-test.ts` knows which tiers need this
  file merged in and which are self-contained (`smoke`, `order-lifecycle`,
  `concurrency-claim-race`) - see that file's own comment.
- **No cart scenario/endpoint.** There is no cart backend anywhere in this
  codebase (confirmed: grepped `cart` case-insensitively across
  `services/`, `api-gateway/`, `shared/` - zero matches). `POST /orders` takes
  the full item list in one call; "building a cart" is represented as browsing
  + think-time before that single call.
- **Socket.IO is a dedicated TypeScript runner (`scripts/socket-load-runner.ts`),
  not an Artillery scenario.** websocket-gateway is a pure RabbitMQ -> Socket.IO
  broadcast bridge with zero client-to-server events - Artillery's socket.io
  engine assumes a request/response protocol that doesn't exist here. See that
  script's header comment for the full reasoning (this is the task's own
  documented fallback, not an ad-hoc choice).

## Installation

```bash
cd load-tests
npm install
cp .env.example .env
# edit .env - at minimum set BASE_URL
```

Artillery is pinned to **2.0.21**, not latest. 2.0.22+ requires Node >= 22.13,
while this repo (and its CI) runs Node 20. Bump this once the team moves to
Node 22+.

## Environment variables

See `.env.example` for the full, commented list. The load-bearing ones:

| Variable | Purpose |
|---|---|
| `BASE_URL` | REST API base, **must include `/api/v1`** (e.g. `http://localhost:3000/api/v1`). Point this at `api-gateway` directly for seeding - nginx's rate limits (see [Known limitations](#known-limitations)) make bulk seeding through it painfully slow. |
| `TEST_DATA_PREFIX` | Every generated account is `<prefix>_<role>_<hex>@loadtest.local` - lets `cleanup.ts` and anyone auditing the DB immediately recognize load-test data. |
| `SEED_ACCOUNTS_PASSWORD` | Password used for every generated account. Defaults to the value already committed in `services/auth-service/.../seed-db.ts` (not a secret) - override for shared/staging environments. |
| `DELIVERY_MANAGER_EMAILS` | The 3 pre-existing `DELIVERY_MANAGER` accounts from the repo's own seed data. There is no API to create more (see [Known limitations](#known-limitations)) - this is the pool everything delivery-office-related draws from. |
| `ALLOW_PRODUCTION_LOAD_TEST` | Must be `true` to run anything against a non-localhost target. See [Safety](#safety). |

## Authentication

Verified against `services/auth-service`:

- `POST /auth/register` `{ email, password, role, deviceId, platform?, appId? }` -
  `role` is any real `UserRole` (`CUSTOMER`, `VENDOR`, `COURIER`, `DELIVERY_MANAGER`,
  `ADMIN`); the auth layer itself does not restrict which role can self-register
  (the web frontend just happens to hardcode `CUSTOMER`).
- `POST /auth/login` `{ email, password, deviceId, ... }` -> both return
  `{ success, data: { accessToken, refreshToken, user }, message }`.
- **Every account has exactly one active session.** `AuthService.login()` calls
  `sessionRepo.revokeAllForUser()` before creating the new session - logging in
  twice concurrently with the *same* account invalidates whichever session
  logged in first. This is why every customer/vendor VU here self-registers a
  brand-new account (`processors/auth.ts:registerCustomer/registerVendor`)
  rather than sharing a small pool: unlimited scale, zero collision risk.
  Personas that *must* share a small fixed pool (delivery managers - see below,
  and any courier/vendor CSV pool you size too small) will experience real
  session-churn 401s if you run more concurrent VUs than distinct accounts -
  that is a real system constraint being surfaced, not a bug in the harness.
- Roles: `CUSTOMER`, `VENDOR`, `COURIER`, `ADMIN`, `DELIVERY_MANAGER`
  (`shared/src/enums/roles.ts`). There is no `DELIVERY_OFFICE` role - a
  `DeliveryOffice` is a separate entity 1:1 with a `DELIVERY_MANAGER` user.

## Test data

`scripts/seed.ts` creates data through the real APIs, never direct SQL:

```bash
npm run loadtest:seed -- --customers 200 --vendors 20 --couriers 30 --orders 0
```

| Persona | How | Written to |
|---|---|---|
| Customer | `POST /auth/register` (unlimited, self-service) | `data/generated/customers.csv` |
| Vendor | register + `POST /vendors` + `POST /catalog/products/vendor/:id/bulk-add-global` with real price/stock (see note below) | `vendors.csv`, `vendor-products.csv`, `vendor-products-with-owner.csv` |
| Courier | register + `POST /delivery/couriers` **as an existing delivery manager** (couriers cannot self-serve a profile) | `couriers.csv` |
| Delivery office | not created - the 3 pre-existing `DELIVERY_MANAGER` accounts are the only ones available | `delivery-managers.csv` |

Full detail, including why there are two vendor-product CSVs, in `data/README.md`.

**Before seeding vendors, make sure global products exist.** `seed.ts` checks
`GET /catalog/global-products` up front and fails fast with instructions if it's
empty, rather than failing confusingly deep inside the vendor loop. This is a
real, discovered gap in a freshly-seeded environment, not a load-test bug - see
[Known limitations](#known-limitations).

**Also note:** `bulk-add-global`'s `{globalCategoryId}`-only shortcut creates
every product with `price=0`, `stockQuantity=0`, `isAvailable=false` (verified
directly against `vendor-product.repository.ts:bulkAddFromGlobalProducts`'s
defaults) - i.e. never orderable. `seed.ts` builds explicit `items` with real
price/stock instead, and additionally filters out any product that still comes
back unavailable/out-of-stock (the catalog's own synthetic product generator
deliberately creates some for UI-state realism) before writing it to a CSV, so
every product this suite hands to a customer VU is actually orderable.

## Traffic model

`tests/_shared-scenarios.yml` (out of 100, rebalanced from the task brief's
cart-inclusive split since there is no cart):

```
Customer                 90%
  Browse                 45%  (of total: 45)
  Search                 20%  (of total: 18 - 90% * 20%)
  Vendor + product detail 15%  (of total: 14)
  Place order            20%  (of total: 20 - includes rounding to hit 100)
Vendor                    7%
Delivery office           2%
Courier                   1%
```

These are starting assumptions, not measured production traffic - the task
brief is explicit that real analytics should eventually replace them. Change
the `weight:` on each scenario in `tests/_shared-scenarios.yml` directly.

## Running tests

All commands assume `cd load-tests` first.

```bash
npm run loadtest:seed -- --customers 50 --vendors 10 --couriers 10   # once, before anything below

npm run loadtest:smoke                 # ~60s, 8 VUs - safe to run frequently
npm run loadtest:baseline              # 5 min, ~5 sessions/sec sustained
npm run loadtest:normal-load           # ramps 100 -> 1000 new sessions/sec
npm run loadtest:stress                # ramps 1000 -> 10000/sec, no pass/fail gate
npm run loadtest:spike                 # 50 -> 500 -> 50/sec, watch recovery
npm run loadtest:soak                  # default 10 min (override for the real 2h run)

npm run loadtest:order-lifecycle       # one full multi-role journey per VU
npm run loadtest:prepare-race          # sets up ONE claimable delivery
npm run loadtest:concurrency           # races 3 delivery managers to claim it

npm run loadtest:socket -- --connections 200 --role CUSTOMER --duration 60
npm run loadtest:socket -- --mode latency --connections 20   # see script header for why VENDOR/VENDOR_ORDER_CREATED

npm run loadtest:cleanup               # deactivates/deletes only what seed.ts created
```

Every `loadtest:*` script accepts `-- --env <name>` (from `config/environments.yml`)
and `-- --phases '<json array>'` (overrides that tier's default phases wholesale,
via Artillery's own `--overrides` flag - one mechanism, not a per-tier scheme):

```bash
npm run loadtest:baseline -- --env local-nginx --phases '[{"duration":600,"arrivalRate":10}]'
```

## Performance thresholds

Enforced via Artillery's bundled `ensure` plugin (`config.plugins.ensure` -
confirmed the exact schema empirically: it needs `plugins.ensure` present to
even load, and reads checks from either `config.ensure` or `config.plugins.ensure`).
A failing threshold sets a non-zero exit code - verified directly, this is a real
CI-usable signal, not cosmetic.

| Tier | Threshold |
|---|---|
| smoke | p95 < 1000ms, error rate < 5% (loose - it's a reachability check) |
| baseline, normal-load | p95 < 500ms, p99 < 1000ms, error rate < 1% (general read-API SLO) |
| stress, spike, soak | **none, deliberately.** These exist to find where the system breaks, not to pass/fail against a pre-committed number - watch the live per-phase output and record the phase where things degrade. |

The general read-API SLO above (p95<500/p99<1000) is applied as one aggregate
gate across the whole weighted mix, which is read-dominated (~72% of weight).
To isolate mutation-only (order-create/accept/status) latency specifically,
enable `config.plugins.metrics-by-endpoint` (also bundled with Artillery) and
read the per-named-request breakdown in your first report - the mutation SLO in
the original task brief (p95<800/p99<1500) intentionally isn't wired into
`ensure` yet, since guessing at exact per-endpoint metric names before seeing a
real report risks silently checking nothing.

## Reports / how to interpret them

Every `loadtest:*` run writes a JSON report to `reports/<tier>-<timestamp>.json`
(gitignored) via Artillery's `-o` flag, plus the live summary printed to the
terminal. Key fields:

- **`arrivalRate` is new sessions started *per second*, not concurrent users
  and not requests/sec.** A rough concurrent-session estimate is
  `arrivalRate * (vusers.session_length mean, in seconds)`. `http.request_rate`
  in the report is the actual requests/sec, which is a different, usually
  larger number since one session makes several requests.
- `http.response_time.{p50,p95,p99}` and per-status-code counters
  (`http.codes.200`, `.400`, etc.) are the core latency/error picture.
- Named counters like `auth.register.customer.success`,
  `vendor.pending_order.none`, `concurrency.delivery_claim.won/lost_expected/unexpected_error`
  (from `processors/*.ts`) surface business-outcome signal that raw HTTP codes
  don't - e.g. `concurrency.delivery_claim.unexpected_error` (5xx under
  contention) is a real problem; `lost_expected` (400/404, someone else claimed
  it first) is the system working correctly.
- `Checks:` at the end of a run shows each `ensure` threshold's pass/fail.

## Infrastructure monitoring

No Prometheus/Grafana exists in this repo - `scripts/vps-monitor.sh` is the only
existing monitoring, and it's a cron-based resource-threshold emailer (CPU/RAM/
swap/disk), not a live dashboard. Watch these directly while a test runs
instead of standing up a new stack for it:

```bash
docker stats                                    # CPU/RAM per container, live
docker compose logs -f --tail=50 <service>      # e.g. order-service, rabbitmq

# MySQL
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "SHOW STATUS LIKE 'Threads_connected'; SHOW PROCESSLIST;"
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "SHOW STATUS LIKE 'Slow_queries';"

# RabbitMQ - queue depth/consumers/publish-rate (exchange: citymarket_events, topic)
docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers
# or the management UI on :15673 (local) / :15672 (as mapped in docker-compose.yml)

# Redis - used only for SLA-timer BullMQ queues (order-service, delivery-service),
# not general caching/sessions
docker compose exec redis redis-cli INFO memory
docker compose exec redis redis-cli INFO clients
```

## Determining CityMarket's capacity

Follow this sequence, never skip to stress:

1. `smoke` - confirm the target, auth, and seed data are all reachable.
2. `baseline` - confirm the read-API SLO holds at a known, moderate load.
3. `normal-load` - find where latency/error rate starts trending upward.
4. `stress` - find the actual breaking point. Stop early (Ctrl+C - Artillery
   prints a full summary of everything up to that point) once p95/p99 blow past
   the SLO or error rate climbs past ~1%.
5. Fill in a capacity report using the exact numbers from that run:

```
CITYMARKET CAPACITY REPORT
Environment:      <local | local-nginx | your staging>
Test:             stress.yml, phase reached: <name/arrivalRate>
Sustainable RPS:  <http.request_rate at the last healthy phase>
p95 / p99:        <from that phase>
Error rate:       <from that phase>
Primary bottleneck:   <e.g. MySQL connections, from docker stats/SHOW PROCESSLIST during the run>
Breaking point:       <arrivalRate where thresholds first failed>
Recommended safe capacity: <breaking point, with meaningful margin>
```

Never report "CityMarket supports N users" - report registered/generated
accounts, concurrent sessions (estimated per above), and requests/sec
separately, since they are not the same number.

## Safety

- `scripts/lib/safety.ts` refuses to run **anything** (including `seed`/`cleanup`)
  against a target that doesn't look like `localhost`/`127.0.0.1`/`0.0.0.0`,
  unless `ALLOW_PRODUCTION_LOAD_TEST=true` is set. There is no committed staging
  environment (`config/environments.yml`'s `production` entry is an
  intentionally-invalid placeholder) - fill it in only with explicit
  authorization.
- `cleanup.ts` only ever acts on rows recorded in `data/generated/*.csv` by
  `seed.ts` - never a broad database sweep, never raw SQL.
- Every generated account is clearly prefixed (`TEST_DATA_PREFIX`) and uses the
  `@loadtest.local` email domain.

## FAQ

**What if I want to run tests against the VPS (production)?**

1. Fill in the `production` entry in `config/environments.yml` with your real
   VPS URL - it must include `/api/v1` (e.g. `https://yourdomain.com/api/v1`).
2. Set `ALLOW_PRODUCTION_LOAD_TEST=true` in `.env`. `scripts/lib/safety.ts`
   refuses to run *anything* - including `seed`/`cleanup` - against a
   non-localhost target otherwise. This is a hard gate, not just a warning.
3. Know that seeding creates real accounts in your real database. There's no
   staging environment in this repo, so `loadtest:seed` against the VPS puts
   real `loadtest_*@loadtest.local` rows alongside real customer data. They're
   clearly prefixed and `cleanup.ts` can remove them, but it's worth knowing
   before you do it.
4. Start with `smoke` only, then `baseline` at a conservative rate. Don't jump
   straight to `stress`/`spike`/`soak` against production - those are
   deliberately designed to push the system toward its breaking point, which
   can degrade real users' experience on a live system. Only go further as a
   planned capacity exercise the team is aware of.
5. Raise nginx's rate limits for the test window if you want a meaningful
   result - otherwise a production run just measures the `auth` zone's
   10 req/min/IP limit, not your services' real capacity.

**Will the tests work after pushing to the remote repo?**

Yes, once these changes are actually committed and pushed (as of writing they
are still uncommitted in the working tree) - `load-tests/` is fully
self-contained with its own `package.json`/`.gitignore`. Anyone who pulls the
repo just runs `cd load-tests && npm install` (their own `node_modules`, not
committed) and everything behaves identically.

Pushing also activates `.github/workflows/load-test.yml`: PRs touching
`load-tests/**` get an automatic typecheck job, and a manual-dispatch job
(pick a tier and a `target_url`) becomes available under Actions -> Run
workflow. That manual job runs on the same **self-hosted runner** the existing
deploy pipeline uses - if you point it at the VPS, it's that same machine
making the requests, with no separate network hop from an external load
generator, which is worth factoring into how you read the results.

## Known limitations

Discovered directly while building and validating this suite - not guesses:

- **No cart backend.** See [Architecture](#architecture).
- **Single active session per user** (see [Authentication](#authentication)) -
  shapes every seeding/pooling decision in this suite.
- **No API to create a `DeliveryOffice`** - only `GET /delivery/delivery-offices`
  (ADMIN) exists. Only the 3 pre-existing offices/managers are available unless
  you seed more directly into the database yourself (`data/README.md`).
- **Fresh environments have zero global products by default.**
  `services/catalog-service/src/infrastructure/database/seed-db.ts` has its
  `ProductSeeder` call commented out, and there's no CSV committed for the
  alternate `db:import-global-products` path. I temporarily re-enabled that
  block to validate this suite end-to-end against a live stack (confirmed it
  works cleanly - 458 global products, 1323 vendor listings from one run), then
  reverted it per the team's decision to keep that change separate from this
  PR. **Re-enable it (or supply a global-products CSV) before running anything
  beyond `smoke` for real** - `seed.ts` will tell you this itself if you don't.
- **nginx's rate limits are aggressive for a single-machine load generator.**
  `nginx/nginx.conf`'s `auth` zone allows only 10 req/min/IP (burst 20), `api`
  60 req/min/IP (burst 30). Any real-scale run through nginx (`-e local-nginx`)
  will be dominated by 429s long before any service capacity limit. For a real
  baseline/normal-load/stress run, either point `BASE_URL` at `api-gateway`
  directly (bypasses nginx; `api-gateway`'s own limiter is a much more generous
  100 req/min shared across a single Node process) or temporarily raise these
  zones in a **non-production** nginx config for the test window.
- **`api-gateway` is not part of `docker-compose.yml` at all** - nginx replaces
  it directly in that deployment (its own comment says so). If you're running
  the dockerized stack, `-e local-nginx` (port 80) is your only option; `-e local`
  (port 3000) requires running `api-gateway` separately via `npm run dev:gateway`.
- **`PATCH /auth/users/:id/status` has no auth middleware at all** (unlike
  `/logout`, `/sessions` on the same router) - callable by anyone who knows a
  user id. `cleanup.ts` uses this endpoint for its own legitimate purpose
  (deactivating load-test-generated accounts) but does not exploit it beyond
  that. Recommend the team add an auth+ADMIN guard to this route.
- **`EventType.ORDER_CREATED` is dead code.** `OrderPublisher.publishOrderCreated()`
  exists and `notification-service` subscribes to it, but grepping the entire
  `order-service` source finds zero callers of that method - it never actually
  fires. `web/customer`'s socket listener for it, and this suite's original
  Socket.IO latency probe, both silently wait for an event that never arrives.
  `scripts/socket-load-runner.ts`'s latency mode now probes `VENDOR_ORDER_CREATED`
  instead (confirmed real: fires synchronously during order creation with a
  correct `vendorId`, delivered in 55ms in one validation run) - but the
  customer-facing "your order was placed" realtime notification the frontend
  appears to expect is currently a no-op. Worth a real fix on the product side.
- **No GPS/location-update endpoint for couriers** - "live courier location" is
  not implemented anywhere in `delivery-service`, so it isn't represented here.
- **No per-order Socket.IO room** (`order:{id}`) - only `user:{id}`, `role:{role}`,
  `vendor:{id}`, `courier:{id}`. Don't design a scenario assuming one exists.
- **Only 3 delivery-manager accounts exist by default**, capping
  `concurrency-claim-race.yml`'s race to 3-way. See `data/README.md` for how to
  seed more.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every request 405 | `config.target`/environment is missing the `/api/v1` suffix - falls through nginx's catch-all straight to the customer-web static server, which rejects POST with 405. Every entry in `config/environments.yml` must include `/api/v1`. |
| Every auth call 429 | nginx's `auth` zone (10 req/min/IP) - see [Known limitations](#known-limitations). |
| `product_not_available` / `product_not_found` on order creation | The product referenced is out of stock/unavailable, or was deleted by a previous `cleanup.ts` run without re-seeding. Re-run `npm run loadtest:seed`. |
| `Scenario validation error: "scenarios" is required` | You ran a tier that needs `tests/_shared-scenarios.yml` merged in without it (only affects hand-rolled `artillery run` invocations - `npm run loadtest:*` handles this for you). |
| A whole VU aborts on a step that should be optional (`ifTrue`-guarded) | A `capture` earlier in the flow has no `strict: false` and the source list/field was legitimately empty - Artillery's default for `capture` is `strict: true`, which hard-fails the VU on no match, before `ifTrue` even gets evaluated on later steps. Every capture in this suite already sets `strict: false` for exactly this reason. |
| Socket connects but never receives an event routed to a `vendor:`/`courier:` room | Check `docker compose logs websocket-gateway` for `Failed to fetch vendor profile for user ...` - means `VENDOR_SERVICE_URL`/`DELIVERY_SERVICE_URL` aren't set on that service (this was a real bug, fixed in this repo's `docker-compose.yml` - if you're seeing it again, something reverted that). |
| `login_failed` / unexpected 401s mid-run on a pooled account (vendor/office/courier) | Two VUs logged in as the same pooled account concurrently - single-active-session-per-user kicked one out. Seed a larger pool, or reduce concurrency for that persona. |

## CI/CD

`.github/workflows/load-test.yml` (separate from the existing deploy pipeline
in `main.yml` - never touches it):

- **Pull requests** touching `load-tests/**`: typecheck only. There's no
  committed staging environment and the existing deploy runner is self-hosted
  with production access, so an automatic live smoke/baseline run isn't wired
  up - add one once a staging target exists.
- **Manual dispatch**: pick a tier (smoke/baseline/normal-load/stress/spike/soak)
  and a `target_url`; `allow_production` must be explicitly checked for
  anything beyond localhost (enforced independently by `scripts/lib/safety.ts`
  too, not just this workflow). `order-lifecycle`/`concurrency-claim-race`
  aren't offered here since they need `loadtest:seed`(`:prepare-race`) run
  against that same target first, which isn't safe to assume for an arbitrary
  input - run those from the CLI.

## Validation

This suite was validated against a real, running instance of the stack
(docker-compose, all backend services + nginx + MySQL/Redis/RabbitMQ), not just
read from source. That process found and fixed several real issues along the
way - both in this suite and in the application itself:

- `config/environments.yml` targets were missing the `/api/v1` suffix (405s).
- `tests/smoke.yml` used `arrivalRate` (per-second) where Phase 10 meant a fixed
  total VU count - switched to `arrivalCount`.
- `scripts/run-test.ts` never actually merged `tests/_shared-scenarios.yml` into
  the composite tiers.
- Every `capture` needed `strict: false` (Artillery hard-fails a VU on a
  no-match capture by default).
- `scripts/seed.ts`'s vendor product creation defaulted every product to
  `price=0/stock=0/unavailable` - fixed to supply real values and filter for
  orderability.
- `scripts/prepare-claim-race.ts` polled `GET /delivery/deliveries/pending`
  with a VENDOR token (401 - that route is DELIVERY_MANAGER/ADMIN/COURIER-only).
- `scripts/socket-load-runner.ts`'s latency probe targeted the dead
  `ORDER_CREATED` event - switched to `VENDOR_ORDER_CREATED`.
- **A real application bug**: `docker-compose.yml`'s `websocket-gateway` service
  was missing `VENDOR_SERVICE_URL`/`DELIVERY_SERVICE_URL`, silently breaking
  vendor/courier room-joins for realtime events. Fixed directly in
  `docker-compose.yml` (confirmed: 55ms event-delivery latency after the fix,
  versus a 15s timeout with nothing delivered before it).

`order-lifecycle`, `concurrency-claim-race`, `baseline` (the shared weighted
mix), `smoke`, `cleanup`, and both `socket-load-runner` modes all completed
with `vusers.failed: 0` and every `expect`/`ensure` check passing in their
final validated runs. `normal-load`/`stress`/`spike`/`soak` share the exact
same scenario mechanics as `baseline` (just different phase shapes) and were
not separately re-run at full scale, to avoid load-testing a shared machine
already running other active projects.
