# Load Testing Guide — Learn It, Then Reuse It on Any App

A study guide built from the CityMarket suite in `load-tests/`. Part 0 explains how
our suite fits together; Parts 1–5 are general and apply to any app. For *where* to
point the suite and the results logs, see [load-testing.md](load-testing.md).

---

## Part 0 — How the CityMarket suite fits together

```
npm run loadtest:baseline
  └─ scripts/run-test.ts          checks the target, data and safety, then builds the artillery command
       └─ artillery run -e local
            config/environments.yml     → target URL (http://localhost:3000/api/v1)
            tests/baseline.yml          → phases (how many users arrive, for how long) + thresholds
            tests/_shared-scenarios.yml → the scenarios (what each user does) + CSV data
              │
              ├─ every second, N new "virtual users" (VUs) arrive
              │    each VU picks ONE scenario by weight (Browse 37%, Order 20%, …)
              │    and runs its flow top to bottom, then exits
              │
              ├─ processors/*.ts   your TypeScript hooks that YAML can't express
              │
              └─ HTTP → api-gateway :3000 → auth/catalog/order/delivery… → MySQL
       └─ writes reports/baseline-<time>.json   (raw Artillery metrics)
       └─ scripts/report.ts → reports/baseline-<time>.md   (PASS/FAIL + diagnosis)
```

Three ideas carry most of it:

- **Phases set the load.** `arrivalRate: 5` means 5 *new sessions per second*, not
  5 users in total. Each session lasts ~10 s, so about 50 sessions run at once.
- **Scenarios set what each user does.** `tests/_shared-scenarios.yml` is the only
  file that defines scenarios. The baseline, normal-load, stress, spike and soak
  tiers add only their phases and thresholds on top of it.
- **Processors are the glue.** `beforeRequest: "attachAuthHeader"` or
  `function: "pickOrderableProduct"` in YAML calls the exported TypeScript function
  with that name in `processors/` (all re-exported from `processors/index.ts`).

### Map of the files

| File | Role |
|---|---|
| `scripts/run-test.ts` | Entry point: resolves env, safety check, preflights data and target, runs Artillery, generates report |
| `config/environments.yml` | Target URLs per environment (`local`, `local-nginx`, `production`) |
| `tests/<tier>.yml` | Phases + thresholds for one tier |
| `tests/_shared-scenarios.yml` | Weighted traffic mix + CSV payloads (single source of truth) |
| `tests/smoke.yml`, `order-lifecycle.yml`, `concurrency-claim-race.yml` | Self-contained tests with their own scenarios |
| `processors/auth.ts` | Login/register bodies, `attachAuthHeader` |
| `processors/data.ts` | Picking products/vendors/categories, building the order body |
| `processors/correlation.ts` | Picking IDs from captured lists (pending orders, deliveries) |
| `processors/metrics.ts` | `afterResponse` hooks that count business outcomes |
| `scripts/seed.ts` / `cleanup.ts` | Create test data → `data/generated/*.csv`; delete it afterwards |
| `scripts/report.ts` | Turns Artillery JSON into a Markdown report with a PASS/FAIL verdict |

### One user, step by step ("Customer: Place order")

| YAML step | What happens | Code |
|---|---|---|
| (VU starts) | Takes the next row of `customers.csv` into `context.vars.customerEmail` etc. | `payload:` in `_shared-scenarios.yml` |
| `post /auth/login` + `beforeRequest: customerLoginBody` | Builds the login JSON from those vars | `processors/auth.ts` |
| `capture: $.data.accessToken as accessToken` | Saves the token into `context.vars` | Artillery built-in |
| `get /catalog/products/vendor/{{ poolVendorId }}` + `attachAuthHeader` | Adds `Authorization: Bearer …`; captures the product list into `browseResultsRaw` | `auth.ts` |
| `think: 5` | Waits 5 s like a real user | |
| `function: pickOrderableProduct` | Picks an in-stock product (or the seeded fallback); emits counters like `order.product.from_listing` | `processors/data.ts` |
| `post /orders` + `ifTrue: selectedProduct` | Sent only if a product was picked; `attachOrderPayload` builds the body | `data.ts` |
| `capture $.data.order.id as orderId` → `get /orders/customer-orders/{{ orderId }}` | Uses the new order's ID in the next request | Artillery built-in |

`context.vars` is the VU's memory: CSV fields, captured values and anything a
processor sets all live there. `{{ name }}` in YAML reads from it.
`events.emit("counter", …)` creates the custom metrics you see in reports.

---

## Part 1 — The method (works for any app)

A load test answers one question: **under this much realistic traffic, does the
system stay fast and correct — and if not, what breaks first?**

1. **Write the goal as numbers before any YAML.** Load, what "fast" means, what
   "correct" means. A test without thresholds gives graphs, never a pass/fail.
2. **Model the users.** Personas → journeys → how often each happens. Real apps are
   mostly reads; the mix should be too.
3. **Get the exact API details from the code.** URL, body, auth header and response
   shape for every step. A guessed field name gives a test full of 400s.
4. **Plan the test data.** Seed accounts/entities first, log in during the test,
   prefix everything `loadtest_`, re-seed for every database.
5. **Write the scenarios.** Login → request → capture a value → think → next
   request using that value.
6. **Choose the load profile.** Tiers in order: smoke → baseline → load → stress →
   spike → soak.
7. **Run it while watching the server.** Client numbers say *that* it is slow; DB
   connections, CPU and logs say *why*.
8. **Check the run is valid, then analyse.** A run that hit rate limits, ran without
   data, or missed its concurrency is discarded, whatever its latency.

### The goal, written down (CityMarket example)

| Decide | CityMarket baseline |
|---|---|
| Load | ~50 concurrent sessions |
| Fast | p95 < 500 ms, p99 < 1000 ms |
| Correct | HTTP error rate < 1% |
| Invalid run | any 429, missing test data, concurrency off by > 20% |

### The user model (CityMarket mix)

| Persona | Journey | Weight % |
|---|---|---|
| Customer | Browse | 37 |
| Customer | Place order | 20 |
| Customer | Search | 18 |
| Customer | View vendor + product | 14 |
| Vendor | Accept + confirm an order | 7 |
| Delivery office | Claim pending deliveries | 3 |
| Courier | Pick up a delivery | 1 |

Take weights from analytics if you have them; otherwise make an honest guess. A test
that only hammers `POST /orders` measures a situation that never happens.

### Test data rules

- Seed before the test (`scripts/seed.ts` → `data/generated/*.csv`).
- **Log in, don't register,** during load. Registration is heavier and rate-limited.
- **Account pool ≫ concurrent users.** Two VUs sharing an account can log each other out.
- **Prefix all test data** (`loadtest_…`) so cleanup can delete it.
- **Re-seed whenever you switch databases** — CSVs hold IDs from one specific DB.

### Load tiers

| Tier | Question it answers | Shape |
|---|---|---|
| Smoke | Does the script work at all? | 1–5 users, ~1 min |
| Baseline | Behaviour at normal load | steady, ~5 min |
| Load | Holds the expected peak? | steady at peak |
| Stress | Where does it break? | keep ramping up |
| Spike | Survives a surge and recovers? | sudden jump, then drop |
| Soak | Leaks over hours (memory, connections)? | moderate, long |

Don't run stress until baseline passes — higher tiers only re-measure the same bottleneck.

### Little's law

```
concurrent users = arrival rate × session length
```

5 new users/s × 10 s per session ≈ 50 users at once. That's why `baseline.yml` uses
`arrivalRate: 5`.

---

## Part 2 — Artillery building blocks

### `config`: where, how much, with what data

```yaml
config:
  target: "http://localhost:3000/api/v1"   # base URL      [config/environments.yml]
  phases:                                  # load profile  [tests/baseline.yml]
    - duration: 30
      arrivalRate: 1
      rampTo: 5                            # ramp 1/s → 5/s
    - duration: 300
      arrivalRate: 5                       # hold 5 new users/s
  payload:                                 # CSV → variables
    - path: "../data/generated/customers.csv"
      fields: ["customerEmail", "customerPassword"]
      order: "sequence"                    # each VU gets the next row
      skipHeader: true
  processor: "../processors/index.ts"      # custom JS/TS functions
  plugins:
    ensure:                                # pass/fail thresholds
      thresholds:
        - "http.response_time.p95": 500
      maxErrorRate: 1
    metrics-by-endpoint:                   # per-endpoint latency
      useOnlyRequestNames: true
```

### `scenarios` and `flow`: what one user does

```yaml
scenarios:
  - name: "Customer: Place order"
    weight: 20                # chance this scenario is picked for a new VU
    flow:
      - post:
          url: "/auth/login"
          name: "POST /auth/login"            # groups metrics under one label
          json:
            email: "{{ customerEmail }}"
            password: "{{ customerPassword }}"
          capture:
            - json: "$.data.accessToken"      # JSONPath into the response
              as: "accessToken"               # saved to context.vars.accessToken
      - get:
          url: "/orders/{{ orderId }}"        # {{ }} reads context.vars
          headers:
            Authorization: "Bearer {{ accessToken }}"
          ifTrue: "orderId"                   # skip if orderId is empty
      - think: 3                              # pause like a human
      - loop:                                 # repeat steps
          - get:
              url: "/delivery/deliveries/pending"
        count: 3
```

Useful step options: `name` (metric label), `capture` (`strict: false` to not fail
when missing), `ifTrue`, `beforeRequest`, `afterResponse`, `think`, `loop`, `function`.

### Processors: when YAML isn't enough

```ts
// Step function:   - function: "pickRandomVendorId"
export async function pickRandomVendorId(context, events) {
  const vendors = context.vars.vendorsRaw || [];
  context.vars.vendorId = vendors.length
    ? vendors[Math.floor(Math.random() * vendors.length)].id
    : null;
}

// beforeRequest hook:   beforeRequest: "attachAuthHeader"
export async function attachAuthHeader(requestParams, context) {
  requestParams.headers = {
    ...requestParams.headers,
    Authorization: `Bearer ${context.vars.accessToken}`,
  };
}

// afterResponse hook:   afterResponse: "trackOutcome"
export async function trackOutcome(requestParams, response, context, events) {
  events.emit("counter", response.statusCode === 200 ? "claim.won" : "claim.lost", 1);
}
```

**The core pattern of every realistic load test: capture → pick → use.** Capture a
raw list from a response, a processor picks one item, the next URL uses it. Never
hard-code IDs.

---

## Part 3 — A minimal template for any new app

```
load-tests/
  config/environments.yml     # targets: local, staging
  tests/smoke.yml             # phases + thresholds only
  tests/baseline.yml
  tests/_scenarios.yml        # the weighted mix (single source of truth)
  processors/index.js         # pick / build / count helpers
  data/users.csv              # seeded accounts
  scripts/seed.js             # creates the data through the API or the DB
  scripts/cleanup.js          # deletes everything prefixed loadtest_
```

A complete starting test for a generic shop API:

```yaml
# smoke.yml — run with: npx artillery run smoke.yml
config:
  target: "http://localhost:4000/api"
  phases:
    - duration: 30
      arrivalRate: 1
  payload:
    path: "data/users.csv"
    fields: ["email", "password"]
    order: sequence
    skipHeader: true
  processor: "./processors/index.js"
  plugins:
    ensure:
      thresholds:
        - "http.response_time.p95": 500
      maxErrorRate: 1
    metrics-by-endpoint:
      useOnlyRequestNames: true

scenarios:
  - name: "Browse and buy"
    flow:
      - post:
          url: "/auth/login"
          name: "login"
          json:
            email: "{{ email }}"
            password: "{{ password }}"
          capture:
            - json: "$.token"
              as: "token"
      - get:
          url: "/products?limit=20"
          name: "list products"
          headers:
            Authorization: "Bearer {{ token }}"
          capture:
            - json: "$.items"
              as: "productsRaw"
      - think: 3
      - function: "pickProduct"
      - post:
          url: "/orders"
          name: "create order"
          ifTrue: "productId"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            productId: "{{ productId }}"
            quantity: 1
```

```js
// processors/index.js
module.exports.pickProduct = async (context, events) => {
  const list = context.vars.productsRaw || [];
  const p = list[Math.floor(Math.random() * list.length)];
  context.vars.productId = p?.id ?? null;
  events.emit("counter", p ? "product.picked" : "product.none", 1);
};
```

That covers ~80% of what you need. Everything else in our suite (`run-test.ts`,
`report.ts`, the safety guard) is tooling around this core.

---

## Part 4 — Debugging and tracing

### Run one user, one scenario, with every request and response printed

```bash
cd load-tests
NODE_OPTIONS="-r ts-node/register/transpile-only" DEBUG=http,http:response \
npx artillery run -e local \
  --scenario-name "Customer: Place order" \
  --overrides '{"config":{"phases":[{"duration":1,"arrivalCount":1}]}}' \
  config/environments.yml tests/baseline.yml tests/_shared-scenarios.yml
```

- `arrivalCount: 1` → exactly one VU.
- `--scenario-name` → force that scenario (use the `name:` from the YAML).
- `DEBUG=http` → each request; `http:response` → each response body.
- `run-test.ts` doesn't pass `--scenario-name` through, so this calls Artillery
  directly. Thresholds will "fail" on a 1-user run — ignore that.

### Other techniques

- **Print inside processors:** `console.log(context.vars.browseResultsRaw)` — shows in the Artillery terminal.
- **Short gentle run through the runner:** `npm run loadtest:baseline -- --phases '[{"duration":10,"arrivalRate":1}]'`.
- **Run one scenario file:** `npx ts-node scripts/run-test.ts scenarios/customer-order.yml`.
- **Read the `.md` report first** (status codes, per-endpoint latency, custom counters,
  "Detected problems"), then search the `.json` for details.

### Error names

| You see | Meaning |
|---|---|
| `Failed capture or match` | A `capture` didn't find its JSON path — request failed or response shape changed |
| `errors.ECONNREFUSED` | Nothing listening on the target |
| Many `429` | Rate limiting — start the stack with `npm run dev:loadtest` |
| `500` + server log `Too many connections` | MySQL connection budget exhausted |
| `POST /auth/login` 401 | CSV accounts are from another DB — re-seed |

### Watching the server while a test runs

```bash
# MySQL connections, refreshed every 2 s
watch -n2 "mysql -uabdo -ppassword -e \"SHOW STATUS LIKE 'Threads_connected'; \
  SELECT db, COUNT(*) FROM information_schema.processlist GROUP BY db;\" 2>/dev/null"
```

- More detailed logs: start services with `LOG_LEVEL=debug`.
- Readable `concurrently` output: add `-n gateway,auth,user,…` to `dev:loadtest` so each
  log line is prefixed with the service name instead of `[0]`, `[1]`.
- Query the tables the test touched to see the state it left behind.

### Tracing one request across services (correlation IDs)

`shared/src/node/middlewares/correlation.middleware.ts` reads `X-Correlation-ID` (or
generates one), and `Logger` prints it on every line as `[id]`. As of 2026-10-05 the
chain has three gaps:

1. Artillery doesn't send the header, so each service generates its own random ID.
2. Only gateway, delivery, user, vendor and notification use the middleware — auth,
   catalog and order don't.
3. Service-to-service HTTP clients don't forward the header.

Once fixed, tag each load-test request with an ID like `lt-<vu>-<step>` and
`grep lt-abc123` across all logs to follow one user end to end.

---

## Part 5 — Common mistakes (each one already happened here)

| Mistake | What happened in CityMarket | Rule |
|---|---|---|
| Measuring the rate limiter, not the app | 1,188 VUs failed with 429 | Raise/bypass rate limits for the test environment |
| Registering a new account per VU | Hit the auth limit, added heavy writes | Seed accounts, then log in |
| Stale test data | Logins 401 — CSVs came from another DB | Re-seed for every environment |
| Sharing accounts between concurrent users | Login revokes the other session | Account pool ≫ concurrency |
| Confusing arrival rate with concurrency | Assumed "5" meant 5 users | Use Little's law; measure it |
| Trusting `maxErrorRate` alone | It counts failed VUs, not failed requests | Also gate on HTTP error rate (`report.ts` does) |
| Each run leaving state that slows the next | PENDING-delivery backlog grew run after run | Balance the mix (what's created gets consumed); clean up |
| Only watching the client | `500` with no explanation | Watch DB connections, CPU, logs during the run |
| Generator on the same machine as the app | They compete for CPU | OK for learning; separate machine for serious numbers |
| Merging two files that both define `scenarios:` | Artillery merges arrays index-by-index → corrupted flows | Scenarios live in exactly one file |

---

## Part 6 — Exercises (do them in this repo)

1. **Read one flow by hand.** Take "Customer: Place order" in
   `tests/_shared-scenarios.yml`, find every processor it calls, and explain where each
   `{{ variable }}` comes from.
2. **Run one user with full output** using the Part 4 command. Match each printed
   request to its YAML step. Repeat for all 7 scenario names.
3. **Break it on purpose.** Change a capture path to `$.data.wrongToken`, watch for
   `Failed capture or match`, then change it back.
4. **Add a step.** Add `GET /catalog/products/:id` after picking a product in the order
   scenario; run smoke.
5. **Add a metric.** In `pickRandomCategoryId`, emit `category.none` when the list is
   empty; find it in the `.md` report.
6. **Write a new scenario from scratch** — e.g. a customer viewing order history,
   `weight: 5` (reduce Browse to 32 so weights still total 100). Verify the API in the
   order-service routes first.
7. **Do the maths.** Sessions last 15 s and you want 100 concurrent users — what
   `arrivalRate`? (Answer: ≈ 6.7/s.)
8. **Transfer it.** Pick any other API you know (even a tiny Express app), build the
   Part 3 layout from memory, and run smoke, then baseline.
