# Maps, Delivery Fees & the New Borg El Arab Service Area

Date: 2026-10-16
Status: plan — nothing in this document is implemented yet.
Supersedes the order-only plan in `docs/service-area-geofencing.md` (that plan
predates the mobile map pickers and only blocked order creation).

This document covers three connected problems:

1. Google Maps must work reliably in the **Customer** and **Vendor** apps so
   addresses and store locations are saved with real, accurate coordinates.
2. The **delivery fee** must be calculated from those real coordinates using
   our own price list, not hard-coded numbers and straight-line guesses.
3. All **four mobile apps** (Customer, Vendor, Courier, Delivery) must only
   work inside **New Borg El Arab** (or whatever region we configure).

They depend on each other: the fee and the region check are only as good as
the coordinates, so Part 1–2 come first.

---

## Contents

- [Summary](#summary)
- [Part 1 — Google Cloud setup](#part-1--google-cloud-setup)
- [Part 2 — Map picker fixes (Customer + Vendor)](#part-2--map-picker-fixes-customer--vendor)
- [Part 3 — Delivery fee calculation](#part-3--delivery-fee-calculation)
- [Part 4 — Restricting service to New Borg El Arab](#part-4--restricting-service-to-new-borg-el-arab)
- [Part 5 — Testing with real coordinates](#part-5--testing-with-real-coordinates)
- [Implementation checklist](#implementation-checklist)
- [Open decisions](#open-decisions)

---

## Summary

### What already exists

| Piece | Where | State |
|---|---|---|
| Map + places search libraries | `mobile/Customer`, `mobile/Vendor` — `react-native-maps@^1.27`, `react-native-google-places-autocomplete@2.6.4` | Installed |
| API key wiring | `.env` → `react-native-config` → `AndroidManifest.xml` (`com.google.android.geo.API_KEY`) and `AppDelegate.swift` (`GMSServices.provideAPIKey`) | Wired |
| Customer address picker | `mobile/Customer/src/components/MapPickerModal.tsx`, used by `AddressesScreen.tsx` | Works, with bugs (Part 2) |
| Vendor store location picker | `mobile/Vendor/src/components/StoreMapPickerModal.tsx`, used by `ProfileScreen.tsx` and `StoreApplicationScreen.tsx` | Same code and bugs as customer |
| Fee quote at checkout | `GET /orders/delivery-fee?lat&lng&vendorIds` → `order.controller.ts:getDeliveryFeePreview` | Works |
| Fee at order creation | `order-creation.manager.ts:195` → `DeliveryFeeCalculator.calculate` | Same formula as the quote |
| Courier GPS heartbeat | `mobile/Courier/src/hooks/useLocationHeartbeat.ts` → `PATCH /couriers/me/location` | Works (freelancers, every 60 s) |
| Region restriction | — | **Does not exist anywhere** |

### What is wrong

- Maps may show grey tiles / empty search if the Google Cloud project, APIs
  and key restrictions are not set up exactly right (Part 1).
- The picker opens in **Riyadh**, has **no "my location"**, and the saved
  address text **goes stale** when the user drags the pin after searching
  (Part 2).
- The fee is **5 EGP + 2 EGP/km straight-line, max 45**, with a silent
  **15 EGP fallback** when any coordinate is missing. Straight-line distance
  under-charges real road trips (Part 3).
- Nothing stops a customer, vendor, courier or office outside New Borg El Arab
  from using the platform (Part 4).

### What this plan delivers

- Accurate pins (GPS + reverse geocoding + fixed center pin) in both apps.
- A configurable fee (admin-editable prices, optionally real road distance).
- A single **service area** definition enforced by the **backend** on every
  coordinate that enters the system, plus friendly **in-app gating** in all
  four apps.

---

## Part 1 — Google Cloud setup

Most "maps don't work" reports are configuration, not code.

### 1.1 Project and billing

- One Google Cloud project for CityMarket.
- **Billing must be enabled.** Without it the map renders grey or with a
  "For development purposes only" watermark, and Places returns
  `REQUEST_DENIED`. Google gives a monthly free usage credit; set a **budget
  alert** in Billing so a bug (e.g. reverse geocoding on every frame) can't
  surprise you.

### 1.2 APIs to enable

| API | Used by | Why |
|---|---|---|
| Maps SDK for Android | Customer, Vendor (Android) | Draw the map |
| Maps SDK for iOS | Customer, Vendor (iOS) | Draw the map |
| Places API (New) | Address search box | Autocomplete |
| Geocoding API | Picker | Turn the pin position into an address text |
| Routes API *(optional)* | order-service | Real driving distance for the fee (Part 3.3) |

> Since March 2025 new projects can't enable the **legacy** "Places API".
> Our library (v2.6.4) supports the new one via the `isNewPlacesAPI` prop —
> we must set it (Part 2).

### 1.3 Keys — use two (or three)

**Key A — Maps SDK key (goes in the native app)**

- Application restriction: **Android apps** → add each app's package name +
  SHA-1; **iOS apps** → bundle IDs. (Or make one Android key and one iOS key.)
- API restriction: Maps SDK for Android, Maps SDK for iOS.
- SHA-1s you need for **each** app (Customer, Vendor):
  - debug keystore,
  - release keystore,
  - **Play App Signing** key (Play Console → Setup → App signing) if published
    on Google Play — Google re-signs the app, so the release SHA-1 alone is
    not enough.
- Get them with:
  ```bash
  cd mobile/Customer/android && ./gradlew signingReport
  cd mobile/Vendor/android && ./gradlew signingReport
  ```
- Missing the release/Play SHA-1 is the classic cause of "map works in debug,
  grey in the APK I sent to a friend".

**Key B — Places + Geocoding key (web-service calls)**

- `react-native-google-places-autocomplete` and reverse geocoding call Google
  over plain HTTPS from JavaScript. Those requests don't carry the Android
  package/SHA-1, so an Android-restricted key is **rejected**.
- Option 1 (quick): restrict Key B by **API only** (Places API (New), Geocoding
  API). The key is extractable from the APK, so keep quotas/budget alerts on.
- Option 2 (recommended for production): **proxy through our backend** —
  e.g. `GET /geo/autocomplete`, `GET /geo/reverse` in a small module behind
  the gateway. The key lives only in server env, we can rate-limit per user,
  and we can apply the service-area restriction server-side (Part 4).
  The library supports a custom base URL via its `requestUrl` prop.

**Key C — Routes key (server only, optional)**

- IP-restricted to the VPS, API-restricted to Routes API. Never shipped in
  an app.

### 1.4 Where keys go

- `mobile/Customer/.env`, `mobile/Customer/.env.docker`, `mobile/Vendor/.env`:
  `GOOGLE_MAPS_API_KEY=...` (Key A). Add `GOOGLE_PLACES_API_KEY=...` (Key B)
  if we don't proxy.
- **After changing `.env`, rebuild the native app**
  (`npx react-native run-android` / rebuild in Xcode). The Android manifest
  reads the key as a build-time string resource — a Metro reload won't pick
  it up.
- Never commit real keys; keep `.env.example` with placeholders.

### 1.5 Google Play: signing, SHA-1s and publishing

This section explains the usual reason the map works on your machine but
shows grey tiles for users who install from Google Play.

#### Why Play breaks the map

Every Android app is signed with a certificate. Key A (1.3) only lets apps
draw the map if their **package name + certificate fingerprint (SHA-1)**
are on its allow-list. The same app can be signed with three different keys,
depending on how it reached the phone:

| How the app got onto the phone | Signed with | SHA-1 to add to Key A |
|---|---|---|
| `npx react-native run-android` (dev) | `android/app/debug.keystore` | Debug SHA-1 |
| APK built locally and sent to someone | Your release (upload) keystore, e.g. `my-release-key.keystore` | Upload key SHA-1 |
| Installed from Google Play (including internal testing) | **Google's app signing key** | App signing key SHA-1 |

The last row is the one people miss. New apps on Play must use **Play App
Signing**: you upload an `.aab` signed with your **upload key**, and Google
removes that signature and re-signs it with an **app signing key** that only
Google holds. Phones that install from Play get Google's certificate. If that
SHA-1 isn't on Key A, the map is grey for every Play user, even though all
your local tests worked.

#### Steps (repeat for Customer and Vendor, and any other app that shows a map)

1. **Local SHA-1s** (debug and upload key):
   ```bash
   cd mobile/Customer/android && ./gradlew signingReport
   # or for a single keystore:
   keytool -list -v -keystore app/my-release-key.keystore -alias my-key-alias
   ```
2. **Google's SHA-1.** Only available after the first upload of the app to
   Play Console (an internal testing upload is enough):
   Play Console → the app → **Test and release → Setup → App integrity →
   App signing**. The page shows:
   - **App signing key certificate:** Google's key. Copy its SHA-1.
   - **Upload key certificate:** must match your release keystore's SHA-1.
     If it doesn't, you built with the wrong keystore.
3. **Add them to Key A.** In Google Cloud Console → APIs & Services →
   **Credentials** → Key A → Application restrictions → **Android apps** →
   Add, one row per SHA-1:
   ```
   <customer package>  + debug SHA-1
   <customer package>  + upload SHA-1
   <customer package>  + Play app signing SHA-1
   <vendor package>    + the same three for Vendor
   ```
   Changes can take a few minutes to apply. No new build is needed, because
   only the key's allow-list changes, not the app.

#### Current problems in our apps (found 2026-10-16)

**1. Package names are too generic.**

| App | Current `applicationId` | Suggested |
|---|---|---|
| Customer | `com.customer` | `tech.citymarket.customer` |
| Vendor | `com.vendor` | `tech.citymarket.vendor` |
| Courier | `com.courier` | `tech.citymarket.courier` |
| Delivery | `com.delivery` | `tech.citymarket.delivery` |

Package names must be unique across all of Google Play, these are very
likely already taken, and **a package name can never be changed after the
first upload**. Rename them before publishing. Renaming touches:
- `applicationId` in each `mobile/<App>/android/app/build.gradle`
  (`namespace` can stay as-is),
- the package rows on Key A,
- **Firebase**: all four apps have `android/app/google-services.json`, and
  that file is tied to the package name. Register the new package in the
  Firebase project and download a new `google-services.json`, or push
  notifications break,
- iOS bundle IDs, if you want them to match (separate from Android).

**2. Vendor and Delivery release builds are signed with the debug key.**
In `mobile/Vendor/android/app/build.gradle` and
`mobile/Delivery/android/app/build.gradle`, the `release` build type uses
`signingConfig signingConfigs.debug`. Play rejects debug-signed uploads.
Customer and Courier already have a `release` signing config; copy that
setup:
1. Create a keystore:
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore vendor-upload.keystore \
     -alias vendor-upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Put it in `android/app/`, and add `MYAPP_UPLOAD_STORE_FILE`,
   `MYAPP_UPLOAD_KEY_ALIAS`, `MYAPP_UPLOAD_STORE_PASSWORD` and
   `MYAPP_UPLOAD_KEY_PASSWORD` to `android/gradle.properties` (or better,
   `~/.gradle/gradle.properties`, so passwords stay out of the project).
3. Add a `release` entry under `signingConfigs` and point
   `buildTypes.release.signingConfig` at it.
4. Never commit keystores or passwords. **Back them up** (password manager
   plus an offline copy). If you lose the upload key, Google can reset it,
   but only through a support request that takes days. Google keeps the app
   signing key itself, so that one can't be lost.

#### Building for Play

```bash
cd mobile/Customer/android
./gradlew bundleRelease          # → app/build/outputs/bundle/release/app-release.aab
./gradlew assembleRelease        # → APK for side-loading/testing only
```
Upload the `.aab`. Play no longer accepts APKs for new apps. Bump
`versionCode` in `build.gradle` on every upload; Play rejects a repeated
`versionCode`.

#### Restricting Play availability by region

Play Console → the app → **Production** (and each testing track) →
**Countries / regions** → choose **Egypt** only.

That's as narrow as Play goes:
- it's **country-level only**, with no city or polygon option,
- it's based on the user's **Play account country**, not their GPS,
- an APK shared outside Play ignores it completely.

So the New Borg El Arab restriction must be enforced by our backend and apps
(Part 4). The Play country setting only keeps the listing out of other
countries' stores.

#### Order of operations

1. Rename package names (all four apps) and fix the Firebase config.
2. Add release keystores for Vendor and Delivery; back up all keystores.
3. Build the `.aab`s and upload each app to **internal testing**.
4. Copy each app's app signing SHA-1 from Play Console into Key A.
5. Install from the internal testing link on a real phone and check that the
   map and search work.
6. Set Countries / regions to Egypt, then promote to production.

---

## Part 2 — Map picker fixes (Customer + Vendor)

Files:
- `mobile/Customer/src/components/MapPickerModal.tsx`
- `mobile/Vendor/src/components/StoreMapPickerModal.tsx`

The two are copies of each other (only indentation differs). Recommended:
move one implementation into `mobile/shared-ui` (`@city-market/mobile-ui`) as
`MapPicker`, and have both apps use it — so every fix and the service-area
overlay (Part 4) is written once. Remember `npm run build` in
`mobile/shared-ui` after editing; apps consume `dist/`. `react-native-maps`
must then be a peer dependency of shared-ui, not a direct one, so only one
copy is bundled.

### 2.1 Wrong default center

Current: `24.7136, 46.6753` (Riyadh). Fix, in order of preference:
1. `initialLocation` (editing an existing address/store),
2. device GPS position,
3. the service-area center (New Borg El Arab), from config — not hard-coded.

### 2.2 No "use my location"

- Add `@react-native-community/geolocation` (already used by the Courier app,
  same version `^3.4.0`, so the pattern in `useLocationHeartbeat.ts` can be
  copied).
- Android: request `ACCESS_FINE_LOCATION` at runtime with
  `PermissionsAndroid` (the manifest already declares it).
- iOS: add `NSLocationWhenInUseUsageDescription` to `Info.plist` (Arabic +
  English text).
- On the map: `showsUserLocation` and a "locate me" button that calls
  `getCurrentPosition({ enableHighAccuracy: true })` and animates there.
- If permission is denied, the picker still works by search/drag — never
  block the user on it.

### 2.3 Address text goes stale (most important bug)

Today: user searches "X street" → map jumps → user drags to their actual
building → `onRegionChangeComplete` updates the coordinates **but `address`
still says "X street"**. The order then carries text and coordinates that
disagree, and couriers go to the wrong place.

Fix:
- In `onRegionChangeComplete`, **debounce ~600 ms**, then reverse-geocode the
  center (`Geocoding API` / our `/geo/reverse` proxy) and set `address`.
- Show a small "loading address…" state while it runs; disable Confirm until
  it resolves (or allow confirm with coordinates + "Pinned location").
- Use the current app language (`i18n.language` → `ar` / `en`) for the
  result.
- Keep a separate free-text field on the address form ("building / floor /
  apartment / landmark") — reverse geocoding in Egypt rarely gives building
  level detail; the coordinates are the truth, the text is a hint.

### 2.4 Pin jitter

Today a `<Marker>` is re-rendered at `region` on every change, so it lags and
jumps while dragging. Replace with a **fixed pin drawn over the map center**
(an absolutely positioned `View`/icon with `pointerEvents="none"`, its tip at
the exact center) and read the coordinates from the map's center on
`onRegionChangeComplete`. This is the standard "move the map under the pin"
UX and is more precise.

### 2.5 Search not tuned for Egypt / our city

Current `query={{ key, language: 'en' }}`. Change to:
- `isNewPlacesAPI` (required with Places API (New)).
- Language = app language.
- Restrict to Egypt and **bias/restrict to the service area's bounding box**
  so results outside New Borg El Arab don't appear (Part 4).
- `fetchDetails` stays on (we need `geometry.location`). With the new API
  pass only the fields we use (location, formatted address) — fewer fields
  are billed cheaper.
- `debounce={300}` and `minLength={2}` to cut request volume.
- Replace the English hard-coded strings (`"Search for an address..."`,
  `"Move the map to select your location"`, `'Selected Location'`) with
  `t(...)` keys in both locale files.

### 2.6 Vendor specifics

- `StoreApplicationScreen` (registration) and `ProfileScreen` (later edit)
  both save `latitude/longitude`. The store location directly drives every
  fee, so:
  - make the location **required** in the application form,
  - show the chosen point on a small static map in the admin review screen
    so the admin can sanity-check it before approval.
- `vendor.repository.ts:108` uses `if (data.latitude)` — fine for Egypt
  (never 0) but should be `!= null` for correctness.

---

## Part 3 — Delivery fee calculation

### 3.1 Current formula

`services/order-service/src/application/utils/DeliveryFeeCalculator.ts`,
used both for the checkout quote and when the order is created:

```
distance = straight-line (haversine) km from customer to the FARTHEST vendor
fee      = clamp(5 + 2 × distance, min 5, max 45)        // EGP
fallback = 15 if the customer or every vendor lacks coordinates
```

Note: `delivery_fee_tiers` in delivery-service do **not** set the price —
they only split the already-computed fee between courier / office / platform.

### 3.2 Problems

1. **Prices are constants in code.** Changing them needs a deploy.
2. **Straight-line distance under-charges.** Real road distance in Egyptian
   cities is typically 1.3–1.6× the straight line, more when the route has to
   go around blocks, gates or the highway.
3. **Silent 15 EGP fallback.** A vendor with no saved location makes every
   order 15 EGP regardless of distance, and nobody notices.
4. **Multi-vendor orders** are priced by the farthest vendor only. That's a
   valid choice, but it should be a deliberate one (a courier who visits two
   stores drives more than the farthest one alone).
5. `!customerLat` treats 0 as missing (harmless here, but sloppy).

### 3.3 Proposal

**a) Make prices configurable.** New table in order-service `schema.sql`
(edit schema directly, no migration — DBs get reset):

```sql
CREATE TABLE IF NOT EXISTS delivery_pricing (
  id TINYINT PRIMARY KEY DEFAULT 1,           -- single row
  base_fee DECIMAL(10,2) NOT NULL,            -- e.g. 5.00
  per_km_fee DECIMAL(10,2) NOT NULL,          -- e.g. 2.00
  min_fee DECIMAL(10,2) NOT NULL,
  max_fee DECIMAL(10,2) NOT NULL,
  road_factor DECIMAL(4,2) NOT NULL DEFAULT 1.40,  -- used when not calling Routes API
  extra_vendor_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- per additional store in one order
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Or, if the business prices by **distance bands** ("0–2 km = 10, 2–5 km = 15,
5–10 km = 25"), use a band table instead — same idea, admin-editable. Admin
web gets a small "Delivery pricing" settings page; order-service caches the
row (e.g. Redis or in-memory, 60 s).

**b) Choose the distance source.**

| Option | Accuracy | Cost | Effort |
|---|---|---|---|
| Straight line × `road_factor` | OK inside one compact city | Free | Tiny |
| Google Routes API `computeRouteMatrix` (driving) | Real road distance | Billed per element | Medium: server call, timeout, cache, fallback |

For a single compact city like New Borg El Arab, **straight line × road
factor is a reasonable start**; calibrate the factor by comparing 20–30 real
trips against Google Maps driving distance. Move to the Routes API if the
error is still too big.

If using Routes API:
- Call it **only from order-service** with Key C.
- Cache by rounded coordinates (e.g. 4 decimals ≈ 11 m) per vendor, TTL a few
  hours.
- Timeout ~2 s; on failure fall back to straight line × road factor — never
  block checkout on Google.
- The quote (`/orders/delivery-fee`) and `createOrder` must use the **same
  function** so the customer is charged what they were shown.

**c) Remove the silent fallback.**
- Customer coordinates missing → reject (`delivery_location_required`). The
  service-area check in Part 4 already requires them.
- Vendor coordinates missing → that vendor can't be approved / can't receive
  orders (enforced in vendor-service), so the fallback becomes unreachable.

**d) Round** the final fee to 0.5 or 1 EGP so customers see clean numbers.

---

## Part 4 — Restricting service to New Borg El Arab

### 4.1 Principle: the backend is the gate, the apps are the signage

Anything done only inside the apps can be bypassed: users deny location
permission, use a fake-GPS app, call the API directly, or use the customer
web app (`web/customer`, which has raw lat/lng inputs). So:

- **Backend (mandatory):** every coordinate that enters the system is checked
  against the service area, and every action that matters (ordering, going
  online, registering a store/office) is refused outside it.
- **Apps (UX):** explain the restriction early ("CityMarket isn't available
  in your area yet"), draw the area on the map, and stop the user before
  they hit a server error.

App stores can't help much: Google Play / App Store availability is set per
**country** (Egypt), not per city.

### 4.2 Defining the area

**Polygon vs circle.** `service-area-geofencing.md` proposed center + radius.
A **polygon is recommended** instead:
- the city plus its industrial zones is not a circle; a circle big enough to
  cover it also covers desert and neighbouring areas,
- a point-in-polygon check is ~15 lines of code with no library (ray
  casting), so the cost argument against it doesn't really hold,
- it supports more cities later (one polygon per area).

**How to get the polygon:**
1. Open Google **My Maps**, draw a polygon around the area we serve (city +
   any zones we deliver to, with a small margin for GPS drift ~200 m).
2. Export as KML, take the coordinate list.
3. Store it as an array of `{ lat, lng }`.
   ⚠ KML and GeoJSON store points as **`lng,lat`** — swap carefully. A swapped
   polygon lands in the Indian Ocean and blocks everyone.

**Where to store it:**
- Start: one env var in the shared config, e.g.
  `SERVICE_AREA_POLYGON='[{"lat":..,"lng":..}, ...]'` and
  `SERVICE_AREA_NAME="New Borg El Arab"`, plus `SERVICE_AREA_ENFORCED=true`
  (to switch off in local dev/tests).
- Later: an admin-editable `service_areas` table if more cities are added.

**Public endpoint** so apps never hard-code the shape:

```
GET /api/v1/service-area      (no auth)
→ { name, enforced, polygon: [{lat,lng}...], center: {lat,lng}, bounds: {north,south,east,west} }
```

Apps fetch and cache it at startup (React Query, long staleTime). Changing the
boundary then needs no app release.

### 4.3 Shared check

Put one function in `shared/` (`@city-market/shared`) so every service uses
the same logic:

```ts
// shared/src/geo/service-area.ts
export type LatLng = { lat: number; lng: number };

export function isInsidePolygon(p: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) &&
        p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) {
      inside = !inside;
    }
  }
  return inside;
}

export function assertInServiceArea(lat: unknown, lng: unknown): void {
  // if !enforced → return
  // if lat/lng not finite numbers → throw ValidationError("location_required")
  // if !isInsidePolygon(...) → throw ValidationError("outside_service_area")
}
```

The same function is copied into `mobile/shared-ui` for the apps (shared/ is
Node-oriented, see the mobile notes), or shared-ui imports it from shared's
`dist/` like the apps already do for enums.

Add `outside_service_area` and `location_required` to
`shared/src/locales/en.json` and `ar.json` (existing convention: error
messages are i18n keys). Use HTTP 422 so apps can tell it apart from other
validation errors.

### 4.4 Backend enforcement points

| Service | Endpoint / code | Check |
|---|---|---|
| user-service | create/update customer address (`CreateAddressDto`, `user.service.ts`) | Address must be inside. Stops bad addresses at save time instead of at checkout. |
| order-service | `GET /orders/delivery-fee` (`getDeliveryFeePreview`) | Return `outside_service_area` instead of a price. |
| order-service | `OrderService.createOrder` (`order.service.ts:73`, next to `hasActivePenalty`) | Delivery point inside **and** each vendor's store inside. Final safety net — covers the web app and old app versions. |
| vendor-service | store application + profile location update (`vendor.service.ts`, `vendor.repository.ts`) | Store location required and inside. Admin approval refuses out-of-area stores. |
| catalog / vendor listing | customer-facing vendor/product lists | Optionally hide vendors outside the area (should be none once the above is enforced; protects against legacy data). |
| delivery-service | `PATCH /couriers/me/location` (`updateMyLocation`) | Accept the update but, if outside, mark the freelancer **unavailable** for dispatch (`freelance-dispatcher.ts`) instead of rejecting — so we keep tracking a courier who drives slightly out mid-delivery. |
| delivery-service | courier "go online" | Refuse going online when the last known location is outside. |
| delivery-service | office self-registration / onboarding | Office address must be inside. |

Existing data: after enabling, run a one-off SQL check listing vendors,
offices and addresses outside the polygon so they can be fixed or
deactivated (data is reset anyway per our no-migrations rule, but production
data later won't be).

### 4.5 App gating, per app

Common pieces (put in `mobile/shared-ui`):
- `useServiceArea()` — fetches `/service-area`, exposes `isInside(lat,lng)`.
- `OutOfAreaScreen` — Arabic/English: "CityMarket currently serves
  New Borg El Arab only", with a "Try again" / "Change location" action.
- Map overlay: draw the area with `react-native-maps` `<Polygon>` (light
  fill) and shade outside, so users *see* where they can pin.
- Handle the 422 `outside_service_area` error globally in each app's API
  client (show the screen/toast instead of a generic error).

**Customer app**
- On launch (after the area loads): if location permission is granted and the
  GPS position is outside → show `OutOfAreaScreen` (allow browsing as an
  option, but block cart/checkout — decision below).
- If permission is denied → don't block; rely on the address check.
- Map picker: Confirm disabled + message when the pin is outside the polygon.
- Search results restricted to the area bounds (Part 2.5).
- Checkout: if the selected address is outside (e.g. saved before the rule),
  ask the user to pick another.

**Vendor app**
- Registration (`StoreApplicationScreen`): store pin must be inside; show the
  polygon on the picker.
- Profile location edit: same.
- If an existing store is outside: show a banner "Your store is outside our
  service area — orders are paused", don't lock the whole app (they still
  need to see payouts/history).

**Courier app**
- `useLocationHeartbeat` already reports position. Before allowing **Go
  online**, get a fresh fix: outside → refuse with a message.
- While online, if the server marks them unavailable (outside), show a
  persistent banner "You're outside New Borg El Arab — you won't receive new
  jobs".
- Never kick a courier offline in the middle of an active delivery.

**Delivery (office) app**
- Offices work from a fixed address, not live GPS. Enforce at
  `OfficeOnboardingScreen` / signup: office location must be inside (add a map
  picker there if it doesn't have one).
- No launch-time GPS gate — the office manager may legitimately sit elsewhere.

### 4.6 Limits to accept

- **Fake GPS** can fool the launch gate. It can't fool the backend address
  check for the *delivery point* in any way that helps the cheater — the
  courier still drives to that point. For couriers, Android exposes
  `isFromMockProvider` / `mocked` on location results; we can log/flag it.
- **GPS accuracy** near the boundary: the ~200 m margin in the polygon avoids
  rejecting customers who live on the edge.

---

## Part 5 — Testing with real coordinates

### 5.1 Device / emulator

- Android emulator: Extended controls (`…`) → **Location** → search a place →
  "Set location". Or from a terminal:
  ```bash
  adb emu geo fix <longitude> <latitude>     # note: longitude FIRST
  ```
- iOS simulator: Features → Location → Custom Location.
- Physical phone over USB: real GPS, or a mock-location app (Developer
  options → Select mock location app) to test outside/inside.
- Remember the `.env` key change needs a rebuild (Part 1.4).

### 5.2 Test points

Pick these from the final polygon (don't trust guessed numbers — click them
on Google Maps and copy):

| Point | Expected |
|---|---|
| Center of New Borg El Arab | Inside — fee quoted, order allowed |
| Near each edge, ~100 m inside | Inside (margin works) |
| ~1 km outside each edge | `outside_service_area` |
| Alexandria downtown (~31.20, 29.92) | Outside |
| Cairo (~30.04, 31.24) | Outside |
| Swapped lat/lng of the center | Outside (proves validation catches swaps) |
| Missing lat/lng | `location_required` |

### 5.3 Fee checks

1. Give two test vendors real store locations inside the city (Vendor app →
   Profile → store location). Until vendors have locations, every quote is
   the 15 EGP fallback.
2. Call the quote directly:
   ```bash
   curl -H "Authorization: Bearer <customer token>" \
     "http://localhost:3000/api/v1/orders/delivery-fee?lat=<lat>&lng=<lng>&vendorIds=<id1>,<id2>"
   ```
3. Compare `distance × road_factor` with Google Maps **driving** distance for
   the same two points; adjust `road_factor` (or switch to Routes API).
4. Place a real order and confirm `customer_orders.delivery_fee` equals the
   quoted value.
5. Confirm the delivery-service split (tier percentages) applies to the new
   fee.

### 5.4 Region checks per app

- Customer: launch outside → out-of-area screen; pin outside → Confirm
  disabled; API call with outside coords → 422.
- Vendor: register with outside store pin → refused; edit location outside →
  refused.
- Courier: go online outside → refused; drive out while online → banner,
  no new jobs, active delivery unaffected.
- Delivery office: onboarding with outside address → refused.
- Web customer app (raw lat/lng inputs): outside coords → 422 at address save
  and at checkout.

---

## Implementation checklist

**Google Cloud**
- [ ] Billing on + budget alert
- [ ] Enable Maps SDK Android/iOS, Places API (New), Geocoding API (+ Routes API if chosen)
- [ ] Key A (Maps SDK, app-restricted, debug + release + Play SHA-1 for Customer and Vendor)
- [ ] Key B (Places/Geocoding) — API-restricted, or backend proxy
- [ ] Keys in `.env` files, apps rebuilt

**Google Play (1.5)**
- [ ] Rename `applicationId` in all 4 apps (`com.customer` → `tech.citymarket.customer`, etc.)
- [ ] Register the new packages in Firebase, replace each `google-services.json`
- [ ] Release keystores for Vendor and Delivery (currently debug-signed), all keystores backed up
- [ ] Upload `.aab`s to internal testing
- [ ] Add each app's Play app signing SHA-1 + upload SHA-1 to Key A
- [ ] Test the map from a Play-installed build on a real phone
- [ ] Countries / regions = Egypt

**Map picker (shared-ui)**
- [ ] Move picker into `@city-market/mobile-ui`, use from Customer + Vendor
- [ ] Start at initial location → GPS → service-area center
- [ ] Locate-me button + permissions (Android runtime, iOS Info.plist)
- [ ] Fixed center pin
- [ ] Debounced reverse geocoding keeps address text in sync
- [ ] `isNewPlacesAPI`, app language, area-restricted search, i18n strings
- [ ] Building/floor/landmark field on the address form

**Fee**
- [ ] `delivery_pricing` (or bands) table in order-service `schema.sql` + admin page
- [ ] Distance: straight line × road factor (or Routes API with cache + fallback)
- [ ] Same function for quote and order creation
- [ ] Remove 15 EGP fallback; vendor location required
- [ ] Fee rounding

**Service area**
- [ ] Draw polygon, store in config, `GET /service-area`
- [ ] Shared `isInsidePolygon` / `assertInServiceArea` + locale keys
- [ ] Enforce in user-service, order-service (quote + create), vendor-service, delivery-service (location, go-online, office onboarding)
- [ ] `useServiceArea`, `OutOfAreaScreen`, map polygon overlay, global 422 handling in all 4 apps
- [ ] Per-app gating as in 4.5
- [ ] Test matrix from Part 5

---

## Open decisions

1. **Distance source:** straight line × road factor, or Google Routes API
   driving distance?
2. **Price list:** keep 5 + 2/km (min 5, max 45), or the real one — base,
   per-km, min, max, or distance bands? Extra charge per additional store?
3. **Service area boundary:** who draws the polygon, and should it include
   the industrial zones / nearby villages?
4. **Customer outside the area:** block the app completely, or let them
   browse but not order?
5. **Places/Geocoding:** ship an API-restricted key in the app now, or build
   the backend `/geo/*` proxy first?
6. Should `docs/service-area-geofencing.md` be deleted or kept as history once
   this plan is accepted?
