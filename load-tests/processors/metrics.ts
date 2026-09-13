/**
 * Business-outcome metrics that plain HTTP status codes don't capture on their own.
 * Named counters show up in Artillery's summary report and JSON output (Phase 24
 * reporting) alongside the built-in http.* metrics.
 */

type ArtilleryContext = {
  vars: Record<string, any>;
};

type EventEmitter = {
  emit: (event: string, ...args: any[]) => void;
};

/**
 * afterResponse hook for the delivery-office claim race (concurrency test, Phase 18).
 * Exactly one concurrent PATCH /delivery/deliveries/:id/accept should succeed (200);
 * every other concurrent attempt against the same delivery must be rejected, never
 * silently double-accepted. Tags each outcome so the aggregate report shows the
 * win/loss ratio directly instead of it being buried in an undifferentiated 4xx count.
 */
export async function trackClaimRaceOutcome(
  _requestParams: any,
  response: any,
  _context: ArtilleryContext,
  events: EventEmitter,
): Promise<void> {
  if (response.statusCode === 200) {
    events.emit("counter", "concurrency.delivery_claim.won", 1);
  } else if (response.statusCode === 400 || response.statusCode === 409 || response.statusCode === 404) {
    events.emit("counter", "concurrency.delivery_claim.lost_expected", 1);
  } else {
    // Anything else (5xx, timeout-shaped errors) indicates the state machine broke
    // under contention rather than cleanly rejecting the loser - surfaced distinctly
    // so it is never mistaken for the expected "someone else claimed it first" case.
    events.emit("counter", "concurrency.delivery_claim.unexpected_error", 1);
  }
}

/**
 * afterResponse hook for the vendor proposal race (mirrors
 * tests/performance-module/src/scenarios/VendorProposalRace.ts, ground-truthed
 * against POST /orders/vendor-orders/:id/propose). Only one concurrent identical
 * proposal should be accepted per vendor order.
 */
export async function trackProposalRaceOutcome(
  _requestParams: any,
  response: any,
  _context: ArtilleryContext,
  events: EventEmitter,
): Promise<void> {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    events.emit("counter", "concurrency.proposal_race.won", 1);
  } else if (response.statusCode === 400 || response.statusCode === 409) {
    events.emit("counter", "concurrency.proposal_race.lost_expected", 1);
  } else {
    events.emit("counter", "concurrency.proposal_race.unexpected_error", 1);
  }
}

/** afterResponse hook: records whether a vendor-product stock update raced into a negative/invalid state indicator (4xx = correctly rejected, 2xx = accepted). */
export async function trackStockUpdateOutcome(
  _requestParams: any,
  response: any,
  _context: ArtilleryContext,
  events: EventEmitter,
): Promise<void> {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    events.emit("counter", "concurrency.stock_update.accepted", 1);
  } else {
    events.emit("counter", "concurrency.stock_update.rejected", 1);
  }
}
