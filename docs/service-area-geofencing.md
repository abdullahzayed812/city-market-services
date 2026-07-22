Service Area Geofencing — Implementation Plan

---

Goal: prevent a customer from placing an order if their delivery location is not
inside New Borg El Arab city.

Status: planned, not yet implemented — blocked on the two config values in
"Open questions" below.

---

Where the check lives

order-service is the right (and only necessary) place for this — the customer
web app has no map picker today (addresses are entered as raw lat/lng number
inputs, see web/customer/src/pages/AddressesPage.tsx), so there is no
client-side safeguard to lean on, and order-service already receives
deliveryLatitude / deliveryLongitude on every CreateOrderDto.

1. services/order-service/src/core/dto/order.dto.ts
   CreateOrderDto already carries:
     deliveryLatitude?: number
     deliveryLongitude?: number
   Both are optional today with no validation.

2. services/order-service/src/application/services/order.service.ts
   createOrder(dto, userId) — around line 71-76, right next to the existing
   hasActivePenalty check (same "fail fast before opening a DB transaction"
   pattern):

     if (!isWithinServiceArea(dto.deliveryLatitude, dto.deliveryLongitude)) {
       throw new ValidationError("delivery_location_outside_service_area");
     }

   Missing lat/lng is treated as outside the service area (can't verify the
   city without coordinates) and blocks checkout, per product decision.

3. New utility: services/order-service/src/application/utils/ServiceAreaValidator.ts
   A center-point + radius (haversine) check, reusing the same distance
   formula pattern already duplicated in:
     - services/order-service/src/application/utils/DeliveryFeeCalculator.ts
       (haversineDistanceKm, deg2rad)
     - services/delivery-service/src/application/services/delivery.service.ts
       (checkDistances / haversineDistance)

   isWithinServiceArea(lat, lng) returns
     lat != null && lng != null &&
     haversineDistanceKm(lat, lng, config.serviceAreaCenterLat, config.serviceAreaCenterLng)
       <= config.serviceAreaRadiusKm

4. Config — new env vars, following the existing ConfigLoader pattern used
   elsewhere in order-service/src/config/env.ts:
     SERVICE_AREA_CENTER_LAT
     SERVICE_AREA_CENTER_LNG
     SERVICE_AREA_RADIUS_KM
   Added to services/order-service/.env and .env.example.

5. i18n — add delivery_location_outside_service_area to both
   shared/src/locales/en.json and ar.json, matching the existing convention
   where ValidationError messages are i18n keys resolved by the shared
   translator (see e.g. order_must_have_at_least_one_item in en.json).

---

Why center + radius instead of a polygon

New Borg El Arab is a compact, roughly circular urban area, and the codebase
already has zero geofencing/polygon infrastructure (confirmed by repo-wide
search — no "geofence", "polygon", "service area", "zone", or city-boundary
logic exists anywhere today). A haversine circle is a few lines of code,
reuses an existing formula pattern, and needs only 3 config numbers. A real
polygon would need a mapping/GIS library and a source of truth for the
boundary shape, which is disproportionate for one city.

---

Open questions (blocking implementation)

- Center point: latitude/longitude for New Borg El Arab.
- Radius: how many km out from that center should still count as "inside the
  city" (covers GPS drift and the city's actual extent).

Once these two values are provided, the change is: 1 new small file, ~4 lines
added to order.service.ts, 3 new env vars, and 2 new locale entries — no
schema migration needed since deliveryLatitude/deliveryLongitude already
exist on the order.

---

Out of scope (not requested)

- Validating addresses at save-time in user-service (addresses can still be
  saved outside the service area; only order creation is blocked). Worth a
  follow-up if desired, since today nothing stops a customer from saving an
  out-of-area address and only finding out at checkout.
- Any change to the customer app's address form (still raw lat/lng inputs,
  no map picker, no client-side pre-check before hitting the API).
