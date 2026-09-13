/**
 * Request-body construction helpers.
 *
 * Design note: rather than relying on Artillery's whole-object YAML templating
 * (`json: "{{ var }}"`) for bodies that are assembled from previously-captured
 * response data, these run as `beforeRequest` hooks and set `requestParams.json`
 * directly. That keeps the shaping logic in typed, testable code and avoids any
 * ambiguity about how the YAML engine serializes nested captured objects.
 *
 * Ground truth for the order payload (web/customer/src/services/api/orderService.ts
 * and services/order-service CreateOrderDto):
 *   POST /orders { items: [{ vendorProductId, quantity?, weightGrams? }],
 *                  deliveryAddress, deliveryLatitude?, deliveryLongitude? }
 * customerId is derived server-side from the JWT and must NOT be sent by the client.
 * MeasurementType (shared/src/enums, catalog-service vendor_product.entity) is
 * UNIT or WEIGHT - UNIT products take `quantity`, WEIGHT products take `weightGrams`.
 */

type ArtilleryContext = {
  vars: Record<string, any>;
};

type EventEmitter = {
  emit: (event: string, ...args: any[]) => void;
};

// Realistic Borg El Arab neighbourhood-style delivery coordinates (kept in a small
// plausible bounding box around the seeded vendors) so `deliveryFee`/distance logic
// downstream is exercised with sane numbers instead of (0,0).
const DELIVERY_AREA = {
  latMin: 30.86,
  latMax: 30.9,
  lngMin: 29.5,
  lngMax: 29.56,
};

function randomInRange(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 1e6) / 1e6;
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Picks a random product out of a captured list and stashes it for later steps. */
export async function pickRandomProduct(context: ArtilleryContext): Promise<void> {
  const products: any[] = context.vars.searchResultsRaw || context.vars.browseResultsRaw || [];
  if (!products.length) {
    context.vars.selectedProduct = null;
    return;
  }
  context.vars.selectedProduct = products[randomInt(0, products.length - 1)];
}

/**
 * `beforeRequest` hook for the customer order-creation step. Builds a single-item
 * order from context.vars.selectedProduct (a vendor-product object captured earlier
 * in the flow, shaped like catalog-service's VendorProduct: { id, measurementType, ... }).
 */
function buildOrderBody(vendorProductId: string, measurementType: string | undefined) {
  const item: Record<string, any> = { vendorProductId };
  if (measurementType === "WEIGHT") {
    item.weightGrams = randomInt(2, 10) * 250; // 500g-2500g in 250g steps
  } else {
    item.quantity = randomInt(1, 4);
  }
  return {
    items: [item],
    deliveryAddress: `Load test address ${randomInt(1, 9999)}, Borg El Arab`,
    deliveryLatitude: randomInRange(DELIVERY_AREA.latMin, DELIVERY_AREA.latMax),
    deliveryLongitude: randomInRange(DELIVERY_AREA.lngMin, DELIVERY_AREA.lngMax),
  };
}

export async function attachOrderPayload(
  requestParams: any,
  context: ArtilleryContext,
  events: EventEmitter,
): Promise<void> {
  const product = context.vars.selectedProduct;
  if (!product || !product.id) {
    events.emit("counter", "order.create.skipped_no_product", 1);
    // Let the request go through with an empty item list; the API will reject it
    // with a 400 rather than the load test silently faking a valid order.
    requestParams.json = { items: [], deliveryAddress: "Load test - no product available" };
    return;
  }
  requestParams.json = buildOrderBody(product.id, product.measurementType);
}

/**
 * Same shaping as attachOrderPayload, but for tests/order-lifecycle.yml and
 * tests/concurrency-claim-race.yml, which need a specific, known product (so the
 * vendor that later logs in to accept the order is guaranteed to be its owner) -
 * see data/generated/vendor-products-with-owner.csv and scripts/seed.ts.
 */
export async function attachOrderPayloadForPoolProduct(requestParams: any, context: ArtilleryContext): Promise<void> {
  requestParams.json = buildOrderBody(context.vars.poolVendorProductId, context.vars.poolMeasurementType);
}

/** Picks a realistic free-text grocery search term (catalog content is not indexed for the load test, so results may legitimately be empty for some terms - that is expected and tracked, not an error). */
export async function pickSearchTerm(context: ArtilleryContext): Promise<void> {
  const terms = [
    "milk",
    "bread",
    "chicken",
    "rice",
    "oil",
    "cheese",
    "water",
    "eggs",
    "juice",
    "detergent",
    "soap",
    "tomato",
    "sugar",
    "tea",
    "coffee",
  ];
  context.vars.searchTerm = terms[randomInt(0, terms.length - 1)];
}

/** GET /vendors returns { data: Vendor[] } directly (vendor.service.ts:getAllVendors) - no pagination wrapper, unlike catalog product listings. */
export async function pickRandomVendorId(context: ArtilleryContext): Promise<void> {
  const vendors: any[] = context.vars.vendorsRaw || [];
  if (!vendors.length) {
    context.vars.vendorId = null;
    return;
  }
  context.vars.vendorId = vendors[randomInt(0, vendors.length - 1)].id;
}

/** Picks a random category id out of a captured GET /catalog/categories response. */
export async function pickRandomCategoryId(context: ArtilleryContext): Promise<void> {
  const categories: any[] = context.vars.categoriesRaw || [];
  if (!categories.length) {
    context.vars.categoryId = null;
    return;
  }
  context.vars.categoryId = categories[randomInt(0, categories.length - 1)].id;
}
