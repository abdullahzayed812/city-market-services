# CityMarket Mobile — UI/UX Redesign: Audit & Plan

Status log is at the bottom. Started 2026-10-13.

## 1. Architecture (as found)

| App | Path | Display name | Own git repo | Screens |
|---|---|---|---|---|
| Customer | `mobile/Customer` | CityMarket / أسواق المدينة | yes (clean) | 19 |
| Merchant | `mobile/Vendor` | City Seller / سيتي للتجار | yes (clean) | 9 + 3 modals |
| Delivery office | `mobile/Delivery` | City Office / سيتي للمكاتب | yes (clean) | 13 |
| Courier | `mobile/Courier` | City Captain / كابتن سيتي | yes (clean) | 13 |
| Shared RN UI | `mobile/shared-ui` (`@city-market/mobile-ui`) | — | **no VCS** | AppText, DemoAccounts, serverConfig |

`mobile/` is gitignored by the main repo; each app has its own git repo. `shared-ui` has no version control at all.

- All four: React Native CLI (no Expo), `react@19.2.0`, `react-native@0.83.1`, TypeScript 5.8.
- Navigation: React Navigation 7 (native-stack + bottom-tabs). Customer uses a custom animated tab bar; the others use the stock tab bar.
- Data: TanStack Query 5 + axios (`services/api/*`), socket.io for live updates, Firebase messaging, Keychain for tokens.
- i18n: i18next with `ar` (default) + `en` JSON per app. `I18nManager.forceRTL` when Arabic.
- Icons: `lucide-react-native` in all apps. No custom fonts (system font).
- Shared code: `@city-market/shared` (types/enums, prebuilt `dist/`) and `@city-market/mobile-ui` (prebuilt `dist/` via `tsc`).
- Checks available: `npx tsc --noEmit` per app; ESLint in Customer/Courier; Jest configured but effectively no tests. Android emulator (`Pixel7_AVD`) available.

Baseline `tsc` errors before any change: Customer 3, Vendor 7, Delivery 5, Courier 5. All pre-existing: the toast `BaseToastProps.props` typing, `textPrimary`/`textSecondary` typos in each TermsAndConditions screen, Vendor DTO mismatches, and Customer `CustomerOrderStatus.AWAITING_CUSTOMER_CONFIRMATION` (that enum member doesn't exist).

## 2. Visual identity (as found)

- Brand assets: the Customer splash shows a deep forest-green wordmark "City Market / أسواق المدينة" on warm cream, with fruit-colored accents. The launcher icons are unrelated stock clip-art, different for each app.
- Each app has its **own unrelated palette**: Customer mint `#10B981`, Vendor purple `#7c3aed`, Office orange `#f97316`, Courier indigo `#1A237E`. The four apps don't read as one product family.
- Theme files exist but are bypassed: about 157 hardcoded hex colors across screens.

## 3. Highest-impact problems (established from code)

Correctness and trust problems (fix first):
1. **Wrong currency in Customer**: prices render as `$12.00` everywhere (product card, cart, checkout, order details). The other apps use `ج.م` / `EGP` inconsistently (Courier mixes both).
2. **Misleading cart total**: Cart shows delivery as **"Free"** and total = subtotal, but Checkout then adds a delivery fee.
3. **Checkout shows a fake fee** (`15.00` fallback) before an address is selected or the fee API returns.
4. **Fabricated merchant stats**: Vendor dashboard shows hardcoded trends `+2 today` and `+8% vs avg`.
5. **Silent failures**: proposal accept/reject mutations have no `onError`. Almost no screen handles query errors. A failed request shows an empty list or a spinner that never stops, with no retry.
6. Order details print "proposed quantity: x" with an empty value when there's no proposal.

Usability and visual problems:
7. **RTL**: back chevrons (`ChevronLeft`) and "forward" arrows don't mirror in Arabic. About 30 directional icons are wrong in Customer alone. `letterSpacing` is applied to Arabic text (it breaks letter joining on Android). `textTransform: uppercase` and English-only literals ("Out of Stock", "View Cart", "/kg", "Pick Location", "Confirm Location") appear inside Arabic UI.
8. Customer Home: merchant cards are 29% of the screen width with a 64px image and 8–9pt text, which is unreadable. A clock icon labels the address. No pull-to-refresh and no error state.
9. Search fires a request on every keystroke (no debounce). Results have no add-to-cart.
10. The store screen has no hero/cover image even though vendors have `storeImage`. Product rows use index keys.
11. Proposals show "actual" and "proposed" values as separate unrelated rows. There's no clear before → after comparison.
12. Language choice is not persisted: i18n always starts in `ar`, while the native RTL flag persists. Switching to English gives an RTL/LTR mismatch after restart.

Backend gaps (UI will not pretend these exist):
- No product **substitution** proposal type. Proposals are only `QUANTITY_REDUCTION`, `WEIGHT_ADJUSTMENT`, `UNAVAILABLE`.
- No product price or line total on proposals. Only quantities and weights are returned.
- Vendor trend metrics: there's no API for "vs average" or daily deltas.

## 4. Design system decisions

- Single CityMarket palette shared by all four apps through `@city-market/mobile-ui` tokens: primary emerald `#176B45` (matches the splash wordmark), soft green `#E7F4EC`, amber accent `#F5A623`, warm neutral background `#F6F7F5`, ink text `#202923`, plus semantic success/warning/error/info/neutral pairs (foreground + soft background, all text pairs ≥ 4.5:1).
- Apps differ by **density and layout**, not by brand color. Customer is image-rich and expressive. Seller and Office are compact and data-first. Captain uses large type and 56px primary actions.
- Typography: system font (no new font dependency, since bundling a custom Arabic font needs native relinking per app; recommended follow-up). Arabic-safe line heights (~1.45×) and **zero letterSpacing**.
- Each app's existing `theme` keeps its key names but derives its values from the shared tokens. Screens that haven't been redesigned yet get the new palette without layout changes.
- Money: one `formatMoney(amount, currencyLabel)` → `125.50 ج.م`. Western digits, which matches the existing convention in all apps.
- Status: badges always pair an icon or dot **and** a text label (never color alone).

## 5. Screen inventory and order

**P1 Customer** — Home · Search · Category results (Search w/ category) · All stores · Store · Product card · Product details · Cart · Checkout · Review proposals · Order details (+ courier card, stepper, ratings) · Orders list · Addresses · Profile · Language · Vendor reviews · Login · Register · Splash · Terms.

**P2 Seller** — Dashboard · Orders · Order details (+ OrderPreparationModal for proposals) · Products (+ BulkAddProductsModal, price/stock edit) · Earnings · Reviews · Profile (+ store map picker) · Login · Terms.

**P3 Office** — Dashboard · Deliveries (available/active) · Delivery details (1234 lines: assignment, status, money) · Couriers · Add courier · Earnings/settlements (698 lines) · Ratings · Profile · Login · Signup · Office onboarding · Office status · Terms.

**P4 Captain** — Dashboard (active task) · Jobs (available requests) · Deliveries (active/history) · Delivery details (status steps, cash collection, cancel) · Earnings · My ratings · Profile · Login · Signup · Freelance onboarding · Application status · Splash · Terms.

## 6. Implementation sequence

- **B** — Tokens, format helpers, and shared components in `mobile/shared-ui`. Metro React pinning (see risks). Re-point the four app themes to the tokens.
- **C** — Customer: money/RTL/correctness fixes, then Home → Search → Store/ProductCard → Product details → Cart → Checkout → Proposals → Order details → Orders.
- **D** — Seller: remove fabricated stats, dashboard, orders, order details, products/stock.
- **E** — Office: dashboard, deliveries, delivery details split, earnings (operational vs financial separation).
- **F** — Captain: active task first, large actions, cash-to-collect prominence.
- **G/H** — Cross-app consistency, tsc per app, emulator screenshots where the backend is reachable.

## 7. Risks

- **Duplicate React**: shared-ui resolves `react` from the repo-root `node_modules` (19.2.6), not each app's 19.2.0. This is harmless for today's hook-free AppText, but it would crash ("Invalid hook call") as soon as a shared component uses hooks. Mitigation: pin `react`/`react-native` resolution in each app's `metro.config.js` for files inside shared-ui, and verify with a release bundle.
- `shared-ui` has no VCS, so edits there can't be reverted with git. A snapshot is kept before edits.
- No automated UI tests. Verification is `tsc`, bundling, and emulator screenshots (which need a running backend for real data).

## 8. Status log

Detailed per-app changes live in each app's own git working tree (`git -C mobile/<App> status`). `shared-ui` has no VCS.

- **B — done.** `shared-ui`: tokens (`theme/tokens.ts`), `formatMoney/formatWeight/shortId/isNetworkError/apiErrorMessage`, `Button/IconButton/BackButton/BackIcon/ForwardIcon`, `ScreenHeader/Card/SectionHeader/StatusBadge/Chip/SummaryRow/Divider`, `EmptyState/ErrorState/LoadingState/Skeleton`. All 4 app themes re-pointed to the tokens; Metro React pinning added to each `metro.config.js`.
- **C — done (source).** Customer: Home, Search (debounced), AllStores, Store, ProductCard/Row, ProductDetails, Cart, Checkout, ReviewProposals, OrderDetails + stepper, Orders, Addresses, Profile, Login/Register, Language (persisted), VendorReviews. Money is `ج.م` everywhere, the fake "Free"/`15.00` delivery fees are gone, and there are query error states with retry. `tsc`: 1 error (pre-existing toast typing; down from 3).
- **D — done (source).** Vendor:
  - **Screens:** Dashboard, Orders (filter chips with counts, deep-link `filter` param, load-more instead of a false empty state), Order details (proposal before→after with status, cancel confirmation, bottom-sheet proposal editor, NaN-weight guard), Products (list rows with direct Price/Stock buttons, a single validated edit sheet, stock state shown with icon and text, "no price" flag), Earnings (sales − commission = net, pending vs paid), Reviews, Profile, and Login. The tab bar has a pending-orders badge.
  - **Fixes:** Mutations invalidated the wrong list key (`vendorOrders` → `vendor-orders`), so lists went stale after accept/propose. Order mutations had no `onError`. The language choice was never persisted and RTL was never unforced. The Profile showed fabricated working hours, no-op rows, and a hardcoded version.
  - **`tsc`:** 3 errors (toast typing, plus 2 in `OrderPreparationModal.tsx`, which is not imported anywhere); down from 7.
- **E — done (source).** Delivery office:
  - **Screens:** `features/deliveryStatus.ts` (status meta, operational filters, active SLA deadline) and a shared `DeliveryCard`. Dashboard (urgent tiles for accept, assign and in-transit, a "needs action" list, team and rating). Deliveries (filters, including the open pool that was previously unreachable from the list). Delivery details (deadline and primary action first, inline courier assignment, call courier/customer, items with a money breakdown, a working cancel-reason input). Finance (office vs couriers split; settle sheet with date validation; "mark paid" confirmation). Couriers, Profile (real office data), Login, Ratings error state. The tab bar shows a badge for deliveries needing action.
  - **Fixes:** Removed the fabricated "+12%" and "+8.5%" growth stats, the "just now" timestamps on every card, a hardcoded "4.8" courier rating, a fake notification dot, "Central Hub"/"08:00-18:00", the hardcoded version, and the no-op map/phone/forgot-password/support buttons. The cancel "other reason" field was a `Text` and couldn't be typed into. Invalid settlement dates crashed (`toISOString` RangeError). Most `earnings.*` keys were missing, so finance rendered in English. Language is now persisted.
  - **`tsc`:** 1 error (toast typing); down from 5.
- **F — done (source).** Courier:
  - **Dashboard:** current-task hero first. It shows the next stop, pickup countdown, cash to collect, and large Directions/Next-step buttons. Then a one-tap availability toggle, other active deliveries, freelancer jobs, and stats.
  - **Delivery details:** the cash card sits near the top and the current stop is emphasised with large actions. The primary action is 56px. The confirm dialog repeats the amount to collect. A 404 shows "no longer available". Status transitions are unchanged (`nextStep`).
  - **Other screens:** Deliveries (active/history chips, shared `DeliveryRow`), Jobs and `JobCard`, Earnings (server figures only, a negative-net explanation, and a fix for an endless spinner when the profile fails), Profile (real data, persisted language), Login, MyRatings error state. Stack back chevrons now mirror in RTL, and the tab bar no longer hard-codes heights that clip on gesture-nav phones.
  - **`tsc`:** 0 errors.
- **G — done.** All four apps were swept for un-mirrored chevrons, `letterSpacing`, uppercase transforms, `EGP`/`$`, and raw `toFixed` money; none remain. Toast config typing was fixed in all 4 apps (`ToastConfigParams`). **`tsc`:** Customer 0, Vendor 2 (only in `OrderPreparationModal.tsx`, which is not imported anywhere), Delivery 0, Courier 0.
- **H — in progress.** Release bundles plus emulator screenshots. The CityMarket backend isn't running locally, so on-device checks cover only login/RTL and the offline/error states.
