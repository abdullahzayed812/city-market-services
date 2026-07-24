# Cancelled Vendor Orders Leaking Into Delivery Data

This document describes a bug where a vendor order that had been **cancelled**
still showed up as part of a `Delivery` — visible in the delivery-dashboard web
app, the Delivery mobile app, and the Courier mobile app — along with the root
cause and the fix applied.

## 1. Symptom

A cancelled vendor order (a vendor's sub-order within a larger customer order)
would still appear:

- As a pickup stop / address in a courier's route.
- As a vendor-order card / item list inside the delivery detail screen.

...on all three delivery-facing surfaces: `web/delivery-dashboard`,
`mobile/Delivery`, and `mobile/Courier`. All three read from the same
`delivery-service` endpoints, so the bug lived in the backend, not the UIs.

## 2. Background: how a `Delivery` is built

A `Delivery` record is only created once a customer order reaches `READY` —
i.e. once every vendor order on it has resolved to either `CONFIRMED` or
`CANCELLED` (`order-state.manager.ts`, `syncCustomerOrderStatus`). At that point,
`DeliveryService.createDeliveryFromOrder()` fetches the order's vendor orders and
builds a `pickupLocations` array — one entry per vendor, with address/lat/lng —
which is persisted on the `Delivery` row and never touched again after creation.

`Delivery.vendorOrders` (the enriched list shown in the UI, with items/pricing)
is **not** stored — it's rebuilt on every read by re-fetching the order from
`order-service` and matching vendor orders back against `pickupLocations` by ID.

## 3. Root cause

Two separate gaps combined:

### 3.1 Vendor orders can cancel *after* a delivery already exists

The vendor-order state machine (`order-state.manager.ts`,
`isValidVendorStatusTransition`) allows cancellation from several post-confirmation
states — `CONFIRMED → CANCELLED`, `PICKED_UP → CANCELLED`, `ON_THE_WAY →
CANCELLED` — not just before confirmation. So a real sequence looks like:

1. All vendor orders confirm → customer order goes `READY` → a `Delivery` is
   created with a pickup location for each vendor.
2. One vendor then cancels their sub-order (e.g. out of stock) — a valid,
   allowed transition even at this point.
3. Nothing tells the already-created `Delivery` about it.

(`createDeliveryFromOrder` was already fixed in an earlier pass to exclude
`CANCELLED` vendor orders *at creation time* — see `delivery.service.ts:166`.
That fix only covers vendors who cancel *before* the delivery exists.)

### 3.2 Every read path rebuilt `vendorOrders` with no status filter

`getDeliveryById()` and `enrichDeliveriesWithOrderData()` (which backs
`getPendingDeliveries`, `getCourierDeliveries`, `getAllDeliveries`) both matched
vendor orders back onto the delivery purely by **ID membership** in
`pickupLocations` — with no check on the vendor order's current status:

```ts
// before
const deliveryVendorOrderIds = delivery.pickupLocations.map((pl) => pl.vendorOrderId);
delivery.vendorOrders = orderData.vendorOrders.filter((vo) => deliveryVendorOrderIds.includes(vo.id));
```

Since `pickupLocations` is never pruned after creation, a vendor order that
cancelled in step 2 above kept showing up on every subsequent read, in both
`vendorOrders` (item list) and `pickupLocations` (address/route).

This also affected `updateDeliveryStatus()`: `vendorOrdersIds` — published in the
`ORDER_PICKED_UP` / `ORDER_ON_THE_WAY` / `ORDER_DELIVERED` events — was derived
straight from the raw, unpruned `pickupLocations`. On `DELIVERED`, the `items`
payload (flat-mapped from `delivery.vendorOrders`) inherited the same staleness,
meaning a cancelled vendor's items could still flow into whatever downstream
stock/commission logic listens for `ORDER_DELIVERED`.

None of the three frontends filtered by status client-side either — they render
whatever the API returns.

## 4. Fix

All changes are in `services/delivery-service/src/application/services/delivery.service.ts`.
This is a **read-time filter only** — no schema change, no DB writes, no new
events/consumers. `pickupLocations` rows are never deleted; the cancelled ones are
simply excluded from what gets returned.

### 4.1 `getDeliveryById` and `enrichDeliveriesWithOrderData`

Both now compute the set of cancelled vendor-order IDs from the freshly-fetched
order data, prune `delivery.pickupLocations` against it first, then derive
`delivery.vendorOrders` from the already-pruned locations:

```ts
const cancelledVendorOrderIds = new Set(
  orderData.vendorOrders.filter((vo) => vo.status === VendorOrderStatus.CANCELLED).map((vo) => vo.id),
);
delivery.pickupLocations = delivery.pickupLocations.filter((pl) => !cancelledVendorOrderIds.has(pl.vendorOrderId));
const deliveryVendorOrderIds = delivery.pickupLocations.map((pl) => pl.vendorOrderId);
delivery.vendorOrders = orderData.vendorOrders.filter((vo) => deliveryVendorOrderIds.includes(vo.id));
```

This fixes both the address/route list and the item list in one place, for every
read path (`getDeliveryById`, `getPendingDeliveries`, `getCourierDeliveries`,
`getAllDeliveries`) — which covers all three UIs, since they all consume these
same endpoints.

### 4.2 `updateDeliveryStatus`

`vendorOrdersIds` now derives from the already-filtered `delivery.vendorOrders`
instead of raw `pickupLocations`, so the cancelled vendor order's ID no longer
rides along in the `ORDER_PICKED_UP` / `ORDER_ON_THE_WAY` / `ORDER_DELIVERED`
events:

```ts
const vendorOrdersIds = delivery.vendorOrders
  ? delivery.vendorOrders.map((vo) => vo.id)
  : delivery?.pickupLocations?.map((location) => location?.vendorOrderId); // fallback if order-data fetch failed
```

The `DELIVERED` event's `items` array was already flat-mapped from
`delivery.vendorOrders`, so it's corrected automatically by the same fix — a
cancelled vendor's items no longer reach stock/commission processing via that
event.

## 5. Scope / known limitation

This fix corrects what gets **displayed and published**. It does not
retroactively recalculate `Delivery.totalPrice` / `Delivery.itemsCount` stored on
the row itself — those are set once at creation and reflect the original vendor
set. If every vendor order on a delivery ends up cancelled post-creation, the
delivery will show an empty pickup/vendor-order list but its stored totals will
still reflect the original amount. Not addressed here, as it wasn't part of the
reported symptom.

## 6. Files changed

- `services/delivery-service/src/application/services/delivery.service.ts`
