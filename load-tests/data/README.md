# data/

## data/generated/ (gitignored, created by `npm run loadtest:seed`)

| File | Written by | Used by |
|---|---|---|
| `customers.csv` | seed.ts | optional stable customer pool (generate-users.ts equivalent) |
| `vendors.csv` | seed.ts | `tests/_shared-scenarios.yml`'s Vendor persona (random draw, independent of `vendor-products.csv`) |
| `vendor-products.csv` | seed.ts | `tests/_shared-scenarios.yml`'s Customer: Place order persona (random draw, independent of `vendors.csv`) |
| `vendor-products-with-owner.csv` | seed.ts | `tests/order-lifecycle.yml`, `scripts/prepare-claim-race.ts` - one row per product, joined with its OWNING vendor's login, because these two need the same vendor throughout one flow |
| `delivery-managers.csv` | seed.ts | every scenario/test that needs a DELIVERY_MANAGER identity |
| `couriers.csv` | seed.ts | every scenario/test that needs a COURIER identity |
| `race-target.csv` | `scripts/prepare-claim-race.ts` | `tests/concurrency-claim-race.yml` (one shared delivery id every racing VU reads) |
| `<role>-pool.csv` | `scripts/generate-users.ts` | ad-hoc use in your own scenarios via `config.payload` |

All rows are written by `scripts/lib/csv.ts` as plain comma-separated files with a
header row (emails/uuids/numbers/booleans only - nothing that could contain a
comma), and are read back the same way by `readCsv`.

## Why delivery offices are special

There is no endpoint anywhere in the codebase to create a `DeliveryOffice` - the
only route touching them is `GET /delivery/delivery-offices` (ADMIN-only). The
three that ship in the repository's own seed data
(`services/delivery-service/.../seed-db.ts`, tied to the `DELIVERY_MANAGER` /
`DELIVERY_MANAGER_2` / `DELIVERY_MANAGER_3` seeded users) are the only ones
available to this suite by default.

If you need more than 3 for a wider concurrency test than
`tests/concurrency-claim-race.yml`'s default 3-way race, you'll need to insert
directly into the `delivery_offices` table (and a matching `DELIVERY_MANAGER` user
via the normal `POST /auth/register` API) yourself - this suite deliberately does
not do that for you, since Rule 7 of this project is "reuse the existing
database/service architecture", not add a side-channel DB-writer for something the
real product has no self-service path for. Keep any such rows clearly prefixed
(e.g. `loadtest_office_*`) and add their manager accounts' emails to
`DELIVERY_MANAGER_EMAILS` in `.env`.

## Test data prefixing

Every account this suite creates through the API uses the pattern
`<TEST_DATA_PREFIX>_<role>_<random-hex>@loadtest.local` (see `processors/auth.ts`
and `scripts/lib/http.ts`). `scripts/cleanup.ts` only ever acts on rows it finds in
`data/generated/*.csv` - never a broad database sweep - so as long as you don't
hand-edit those files to point at accounts you didn't generate, cleanup stays
scoped to load-test data.
