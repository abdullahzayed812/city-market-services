/**
 * Correlation helpers - never hardcode an ID that should come from a previous
 * response. These functions take a raw JSON array/object already captured via
 * Artillery's native `capture: [{ json: "$.path", as: "xRaw" }]` and pick out the
 * specific record the next request needs, storing scalar IDs on context.vars for
 * use in URL templates like `/orders/vendor-orders/{{ vendorOrderId }}/accept`.
 */

type ArtilleryContext = {
  vars: Record<string, any>;
};

type EventEmitter = {
  emit: (event: string, ...args: any[]) => void;
};

/**
 * order-service GET /orders/vendor/:vendorId returns { data: { items, hasNextPage } }
 * (services/order-service/src/application/services/order.service.ts:getVendorOrders).
 * VendorOrderStatus.PENDING is the only status the vendor can call `.../accept` on.
 */
export async function pickPendingVendorOrder(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  const items: any[] = context.vars.vendorOrdersRaw?.items || context.vars.vendorOrdersRaw || [];
  const pending = items.find((o) => o.status === "PENDING");
  context.vars.vendorOrderId = pending?.id || null;
  context.vars.hasPendingVendorOrder = !!pending;
  events.emit("counter", pending ? "vendor.pending_order.found" : "vendor.pending_order.none", 1);
}

/**
 * delivery-service GET /delivery/deliveries/pending returns { data: Delivery[] }
 * (a plain array - see delivery.service.ts:getPendingDeliveries). Matches by
 * customerOrderId, the field linking a Delivery back to the customer's order.
 */
export async function pickPendingDeliveryForOrder(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  const deliveries: any[] = context.vars.pendingDeliveriesRaw || [];
  const orderId = context.vars.orderId;
  const match = deliveries.find((d) => d.customerOrderId === orderId) || deliveries[0];
  context.vars.deliveryId = match?.id || null;
  events.emit("counter", match ? "delivery.pending.found" : "delivery.pending.none", 1);
}

/**
 * Picks any pending delivery at random (used by scenarios that just need *a*
 * delivery to act on, not one tied to a specific order - e.g. the courier/
 * delivery-office read-heavy scenarios).
 */
export async function pickAnyPendingDelivery(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  const deliveries: any[] = context.vars.pendingDeliveriesRaw || [];
  if (!deliveries.length) {
    context.vars.deliveryId = null;
    events.emit("counter", "delivery.pending.none", 1);
    return;
  }
  // A PENDING delivery that still carries a deliveryOfficeId can never be accepted
  // (the accept UPDATE requires delivery_office_id IS NULL). These are left behind
  // by delivery-service's courier-assignment SLA revert, which sets status back to
  // PENDING but does not clear the office (sla.worker.ts handleAssignmentExpired ->
  // deliveryRepo.update skips undefined fields). Count them so the bug stays visible
  // in every report, but claim a genuinely open delivery like a real office would.
  const stale = deliveries.filter((d) => d.deliveryOfficeId);
  if (stale.length) events.emit("counter", "delivery.pending.stale_office_set", stale.length);
  const open = deliveries.filter((d) => !d.deliveryOfficeId);
  if (!open.length) {
    context.vars.deliveryId = null;
    events.emit("counter", "delivery.pending.none", 1);
    return;
  }
  const pick = open[Math.floor(Math.random() * open.length)];
  context.vars.deliveryId = pick.id;
  events.emit("counter", "delivery.pending.found", 1);
}

/**
 * GET /delivery/deliveries/my-deliveries lists every delivery ever assigned to the
 * courier, newest first - including ones already picked up or delivered. Only an
 * ASSIGNED delivery can move to PICKED_UP, so pick one of those instead of blindly
 * taking items[0] (which produced 400 invalid-transition responses).
 */
export async function pickAssignedDelivery(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  const raw = context.vars.myDeliveriesRaw;
  const items: any[] = raw?.items || raw?.data || (Array.isArray(raw) ? raw : []);
  const assigned = items.find((d) => d.status === "ASSIGNED");
  context.vars.myDeliveryId = assigned?.id || null;
  events.emit("counter", assigned ? "courier.assigned_delivery.found" : "courier.assigned_delivery.none", 1);
}

/**
 * Picks the courier's own courier-profile id off GET /delivery/couriers/me so a
 * delivery-office VU can assign a courier that actually exists.
 */
export async function extractCourierId(context: ArtilleryContext): Promise<void> {
  context.vars.courierId = context.vars.courierMeRaw?.id || null;
}
