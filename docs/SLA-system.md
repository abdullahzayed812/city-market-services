---

City Market — SLA Timer System: Complete Technical Analysis & Implementation Plan

---

PART 1: ARCHITECTURE ANALYSIS

1.1 System Overview

City Market is a 12-service microservices platform (Uber Eats / DoorDash pattern) built with:

┌──────────────────────┬────────────────────────────────────────────────────────────────┐
│ Layer │ Technology │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ Language │ TypeScript on Node.js │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ HTTP Framework │ Express.js (each service is its own Express app) │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ Database │ MySQL — raw mysql2/promise, no ORM, per-service DBs │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ Async Messaging │ RabbitMQ — topic exchange citymarket_events, DLX/DLQ pattern │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ Real-time │ Socket.io WebSocket Gateway that consumes all RabbitMQ events │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ Push Notifications │ Firebase Cloud Messaging via notification-service │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ In-flight Storage │ Redis 7 is deployed (docker-compose, redis:7-alpine) │
├──────────────────────┼────────────────────────────────────────────────────────────────┤
│ Architecture Pattern │ Hexagonal (Ports & Adapters) with DI via constructor injection │
└──────────────────────┴────────────────────────────────────────────────────────────────┘

---

1.2 Order Lifecycle — Exact State Machines

CustomerOrderStatus (the master order, from order-state.manager.ts):

DRAFT
→ PENDING_VENDOR_CONFIRMATION (stock reserved OK)
→ PREPARING (at least one vendor starts preparing)
→ WAITING_CUSTOMER_DECISION (at least one vendor sent proposals)
→ READY (all non-cancelled vendors CONFIRMED)
→ PICKED_UP
→ IN_DELIVERY
→ COMPLETED
(→ CANCELLED from any pre-PICKED_UP state)
(→ CANCELLED_BY_CUSTOMER from any pre-PICKED_UP state)

VendorOrderStatus (per-vendor sub-order, transition map in order-state.manager.ts):

DRAFT
→ PENDING
→ PREPARING
→ PROPOSAL_SENT (vendor proposed changes)
→ CONFIRMED (customer accepted proposals)
→ CANCELLED (customer rejected all)
→ CONFIRMED (vendor accepted immediately)
→ PICKED_UP
→ ON_THE_WAY
→ DELIVERED
(→ CANCELLED from any pre-PICKED_UP state)

DeliveryStatus (from delivery.service.ts):

PENDING
→ ACCEPTED (delivery office accepts within window)
→ ASSIGNED (courier assigned)
→ PICKED_UP
→ ON_THE_WAY
→ DELIVERED
(→ FAILED from any state)

---

1.3 The Two Commented-Out Timer Attempts

This is the most critical architectural finding. Both services have abandoned polling loops:

order-service/src/app.ts:
// setInterval(() => {
// orderService.cancelExpiredOrders().catch(...)
// }, EXPIRY_CHECK_INTERVAL_MS);

delivery-service/src/app.ts:
// setInterval(() => {
// deliveryService.cancelExpiredAssignedDeliveries().catch(...)
// }, EXPIRY_CHECK_INTERVAL_MS);

There is also a full commented-out cancelExpiredAssignedDeliveries() method in delivery.service.ts (lines 589–621) with correct locking logic already written. These were abandoned because setInterval is
fragile — it loses all state on restart, drifts under load, and doesn't survive horizontal scaling.

---

1.4 Existing Queue & Background Job Infrastructure

There is NO BullMQ or any other job queue. The system uses:

- RabbitMQ for event-driven inter-service communication only
- Redis 7 is deployed but currently used only by the API gateway for rate limiting

This is the gap the SLA system must fill. Redis is already available — BullMQ (which requires only Redis) can be added with zero new infrastructure cost.

---

1.5 Database Structure — SLA-Relevant Tables

order_db.customer_orders — no deadline columns, no SLA metadata
order_db.vendor_orders — no deadline columns
delivery_db.deliveries — has assigned_at, picked_up_at, delivered_at (completion timestamps only), no deadline or SLA columns

The acceptedWindowMinutes parameter already exists in DeliveryService constructor (default: 5 minutes), and deliveryRepo.acceptDelivery() uses it — but only to implement the optimistic ACCEPTED window in SQL,
not as a scheduled timeout. The timeout itself never fires.

---

1.6 Real-Time System (WebSocket Gateway)

services/websocket-gateway/src/events.ts subscribes to ALL EventType values from a single RabbitMQ queue called "websocket-gateway-queue". Every new EventType added to the shared enum is automatically
delivered to all connected clients. Room routing is:

- user:{userId} — customer personal events
- vendor:{vendorId} — per-vendor events (with payload filtering to prevent data leakage)
- courier:{courierId} — courier events
- role:DELIVERY_MANAGER — all delivery managers
- role:ADMIN — all events

The gateway already enriches payloads by fetching full order details from order-service. Any new SLA events published to RabbitMQ will automatically be received by clients — no gateway changes required for
basic delivery. Deadline timestamps must be embedded in event payloads.

---

1.7 Notification System

services/notification-service/src/presentation/consumers/event.consumer.ts subscribes to 20+ specific events and dispatches FCM push notifications and in-app notifications. Adding SLA events requires
registering new consumers in this file — following the existing pattern exactly.

---

1.8 Shared Library (@city-market/shared)

The shared library provides: enums, interfaces, RabbitMQ bus, Database, Logger, errors, middleware, config loader, and ServiceAuthenticator. BullMQ infrastructure can be added here as shared/src/node/queues/
— making it available to both order-service and delivery-service with a single import.

---

PART 2: INTEGRATION STRATEGY

2.1 Where the SLA System Should Live

Decision: In-service BullMQ workers, with shared queue utility in @city-market/shared/node.

Rejected: Dedicated sla-service — A separate service would need to reach back into order-service and delivery-service to change state, creating callback dependencies that contradict the hexagonal pattern. It
also adds operational overhead (new container, new DB, new queue bindings).

Rejected: RabbitMQ TTL delays — RabbitMQ supports message TTL but it's imprecise, hard to cancel when a human action completes before the timer, and difficult to reason about in failure scenarios.

Chosen: BullMQ (Redis-backed delayed jobs) inside the owning service:

- order-service owns vendor order state → order-service handles vendor SLA + customer decision SLA
- delivery-service owns delivery state → delivery-service handles all delivery SLAs
- Both connect to the same Redis instance already in the stack
- BullMQ workers are simply another class in the application/ layer

The shared library gets a lightweight SlaQueue wrapper around BullMQ so both services share identical queue configuration, serialization, and error handling.

---

2.2 SLA Checkpoints to Implement

Five SLA checkpoints, matched to the exact state transitions:

┌─────┬────────────────────────────┬─────────────────────────────┬──────────────────┬──────────────────┬─────────────────────────────────────────────────┐
│ # │ SLA Name │ Trigger State │ Owner Service │ Default Duration │ Expiry Action │
├─────┼────────────────────────────┼─────────────────────────────┼──────────────────┼──────────────────┼─────────────────────────────────────────────────┤
│ 1 │ Vendor Confirmation │ VendorOrder → PENDING │ order-service │ 10 min │ Auto-cancel VendorOrder → cascade CustomerOrder │
├─────┼────────────────────────────┼─────────────────────────────┼──────────────────┼──────────────────┼─────────────────────────────────────────────────┤
│ 2 │ Customer Proposal Decision │ VendorOrder → PROPOSAL_SENT │ order-service │ 15 min │ Auto-accept all pending proposals │
├─────┼────────────────────────────┼─────────────────────────────┼──────────────────┼──────────────────┼─────────────────────────────────────────────────┤
│ 3 │ Delivery Office Acceptance │ Delivery → PENDING │ delivery-service │ 5 min │ Fail delivery, publish event │
├─────┼────────────────────────────┼─────────────────────────────┼──────────────────┼──────────────────┼─────────────────────────────────────────────────┤
│ 4 │ Courier Assignment │ Delivery → ACCEPTED │ delivery-service │ 5 min │ Revert to PENDING, release office │
├─────┼────────────────────────────┼─────────────────────────────┼──────────────────┼──────────────────┼─────────────────────────────────────────────────┤
│ 5 │ Courier Pickup │ Delivery → ASSIGNED │ delivery-service │ 30 min │ Cancel assignment, courier back to available │
└─────┴────────────────────────────┴─────────────────────────────┴──────────────────┴──────────────────┴─────────────────────────────────────────────────┘

---

2.3 Modules That Need Modification

┌──────────────────────┬────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Service │ Files to Modify │ Reason │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ @city-market/shared │ events/event-types.ts │ Add 5 new SLA event types │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ @city-market/shared │ node/index.ts │ Export new SlaQueue utility │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ infrastructure/database/schema.sql │ Add 2 deadline columns to vendor_orders │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ core/entities/vendor-order.entity.ts │ Add vendorConfirmationDeadline, customerDecisionDeadline │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ core/interfaces/vendor-order.repository.ts │ Add findExpiredPendingVendorOrders(), findExpiredProposals() │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ infrastructure/repositories/vendor-order.repository.ts │ Implement those queries │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ application/services/order-state.manager.ts │ Add SLA scheduling/cancellation calls │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ application/services/order.service.ts │ Add SLA expiry handler methods │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ infrastructure/messaging/OrderPublisher.ts │ Add SLA event publish methods │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ order-service │ app.ts │ Wire up BullMQ worker & queue │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ delivery-service │ infrastructure/database/schema.sql │ Add 3 deadline columns to deliveries │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ delivery-service │ core/entities/delivery.entity.ts │ Add 3 deadline fields │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ delivery-service │ core/interfaces/delivery.repository.ts │ Add findExpiredPending(), findExpiredAccepted(), findExpiredAssigned() │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ delivery-service │ infrastructure/repositories/delivery.repository.ts │ Implement those queries │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ delivery-service │ application/services/delivery.service.ts │ Add SLA scheduling/cancellation + expiry handlers │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ delivery-service │ infrastructure/messaging/DeliveryPublisher.ts │ Add SLA event publish methods │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ delivery-service │ app.ts │ Wire up BullMQ worker & queue │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ notification-service │ presentation/consumers/event.consumer.ts │ Subscribe to SLA events → push notifications │
├──────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ websocket-gateway │ automatic │ No changes needed — consumes all EventTypes automatically │
└──────────────────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘

New files to create:

┌───────────────────────────────────────────────────────────────────┬────────────────────────────────────────────┐
│ Path │ Purpose │
├───────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ shared/src/node/queues/sla-queue.ts │ BullMQ wrapper with typed job definitions │
├───────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ order-service/src/application/workers/sla.worker.ts │ BullMQ worker: handles SLA expiry jobs │
├───────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ delivery-service/src/application/workers/sla.worker.ts │ BullMQ worker: handles delivery SLA expiry │
├───────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ order-service/src/application/services/order-sla.manager.ts │ Schedules and cancels order SLA timers │
├───────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ delivery-service/src/application/services/delivery-sla.manager.ts │ Schedules and cancels delivery SLA timers │
└───────────────────────────────────────────────────────────────────┴────────────────────────────────────────────┘

---

PART 3: RISK ANALYSIS

3.1 Race Conditions

Risk 1 — SLA job fires at same moment as human action (most critical)

Scenario: BullMQ job fires to auto-cancel a VendorOrder. Simultaneously, the vendor calls POST /vendor-orders/:id/accept. Both arrive at the DB at the same time.

Mitigation: The SLA job handler must open a transaction with SELECT ... FOR UPDATE (row lock) and re-check the current status before acting. If the status has already moved forward, abort silently. This
pattern is already established in the codebase (findByIdWithLock is already used in syncCustomerOrderStatus).

Risk 2 — Double-scheduling on service restart or duplicate event delivery

Scenario: Service restarts while a BullMQ job is in the queue. If the code also schedules a new job on startup, the same SLA fires twice.

Mitigation: BullMQ's jobId deduplication. Set jobId = "sla:{entityType}:{entityId}:{slaType}". BullMQ guarantees only one job with a given jobId can exist in the queue at any time.

Risk 3 — Cascading cancellation during vendor SLA expiry

Scenario: A multi-vendor order has 3 vendors. Vendor A doesn't respond (SLA fires, VendorOrder A cancelled). Vendor B's order is still PENDING. syncCustomerOrderStatus must correctly handle partial
cancellation without cancelling the whole CustomerOrder if other vendors are still active.

Mitigation: The existing syncCustomerOrderStatus already handles allCancelled vs partial states. Verify the logic specifically for the case where one vendor is CANCELLED and others are PENDING — confirm it
stays in PENDING_VENDOR_CONFIRMATION for the remaining vendors.

Risk 4 — BullMQ job fires on DELIVERED/COMPLETED order

Scenario: A vendor job takes much longer than expected to process, or BullMQ backlog builds up. A job for a VendorOrder that is already DELIVERED fires.

Mitigation: Status guard at the top of every job handler:
if (!['PENDING', 'PREPARING'].includes(vendorOrder.status)) {
return; // safe no-op
}

Risk 5 — Redis unavailability

Scenario: Redis goes down. New SLA timers cannot be scheduled.

Mitigation: DB-level deadline columns are the canonical truth. Add a startup scanner that runs once when the service boots: query for any rows where vendor_confirmation_deadline < NOW() and status is still
PENDING — auto-cancel them. Also query for deadlines in the future and re-enqueue BullMQ jobs for them. This makes the system self-healing after Redis failure.

---

3.2 Risky Flows

┌───────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────┐
│ Flow │ Risk │ Mitigation │
├───────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ Vendor SLA + delivery already created │ If vendor order SLA fires after delivery was created, delivery must also be │ Check if CustomerOrder is already in READY+ before cancelling │
│ │ failed │ │
├───────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ Multi-vendor partial acceptance │ One vendor's SLA fires, other vendors accepted → delivery should proceed with │ syncCustomerOrderStatus handles this if correctly guarded │
│ │ remaining items │ │
├───────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ Customer decision SLA auto-accept │ Auto-accepting a proposal changes quantities/weights → affects stock │ Re-check stock after auto-accept (or conservatively accept proposed lower │
│ │ reservation │ quantities) │
├───────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ Delivery SLA + concurrent office accept │ Office accepts just as PENDING SLA fires │ Row lock on delivery record in SLA handler │
├───────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ Courier assignment SLA while courier is │ Should never happen (status check guards this) │ Status guard in handler │
│ en route │ │ │
└───────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────┘

---

PART 4: DATABASE STRATEGY

4.1 Schema Changes

Migration for order_db.vendor_orders (additive, backward-compatible):

ALTER TABLE vendor_orders
ADD COLUMN vendor_confirmation_deadline TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN customer_decision_deadline TIMESTAMP NULL DEFAULT NULL,
ADD INDEX idx_vendor_confirmation_deadline (vendor_confirmation_deadline),
ADD INDEX idx_customer_decision_deadline (customer_decision_deadline);

Migration for delivery_db.deliveries (additive, backward-compatible):

ALTER TABLE deliveries
ADD COLUMN acceptance_deadline TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN assignment_deadline TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN pickup_deadline TIMESTAMP NULL DEFAULT NULL,
ADD INDEX idx_acceptance_deadline (acceptance_deadline),
ADD INDEX idx_assignment_deadline (assignment_deadline),
ADD INDEX idx_pickup_deadline (pickup_deadline);

Rationale for storing deadlines in DB:

1. Enables the startup self-healing scanner to re-enqueue missed jobs after service restart
2. Exposes deadlines via HTTP endpoints for frontend countdown rendering
3. Provides an audit trail of when SLAs were set
4. Allows dashboard queries: "how many orders are approaching SLA breach?"

4.2 Recovery Query Pattern

On service startup, each service runs:

-- Re-enqueue vendor confirmation SLA jobs for orders still waiting
SELECT id, vendor_confirmation_deadline
FROM vendor_orders
WHERE status IN ('PENDING', 'PREPARING')
AND vendor_confirmation_deadline IS NOT NULL
AND vendor_confirmation_deadline > NOW();

-- Auto-cancel orders that already breached SLA (missed during downtime)
SELECT id
FROM vendor_orders
WHERE status IN ('PENDING', 'PREPARING')
AND vendor_confirmation_deadline IS NOT NULL
AND vendor_confirmation_deadline < NOW();

---

PART 5: EVENT STRATEGY

5.1 New Event Types (to add to shared/src/events/event-types.ts)

// SLA Events
SLA_VENDOR_CONFIRMATION_EXPIRED = "SLA_VENDOR_CONFIRMATION_EXPIRED",
SLA_CUSTOMER_DECISION_EXPIRED = "SLA_CUSTOMER_DECISION_EXPIRED",
SLA_DELIVERY_ACCEPTANCE_EXPIRED = "SLA_DELIVERY_ACCEPTANCE_EXPIRED",
SLA_COURIER_ASSIGNMENT_EXPIRED = "SLA_COURIER_ASSIGNMENT_EXPIRED",
SLA_COURIER_PICKUP_EXPIRED = "SLA_COURIER_PICKUP_EXPIRED",
SLA_TIMER_STARTED = "SLA_TIMER_STARTED",

5.2 Event Payload Designs

SLA_TIMER_STARTED — emitted whenever a deadline is set. This is what drives frontend countdowns:

{
type: "SLA_TIMER_STARTED",
payload: {
slaType: "vendor_confirmation" | "customer_decision" | "delivery_acceptance" | "courier_assignment" | "courier_pickup",
entityType: "vendor_order" | "delivery",
entityId: string,
deadline: string, // ISO 8601 UTC
customerOrderId: string,
customerId: string,
vendorId?: string,
courierId?: string
}
}

SLA_VENDOR_CONFIRMATION_EXPIRED — published by order-service SLA worker:

{
type: "SLA_VENDOR_CONFIRMATION_EXPIRED",
payload: {
vendorOrderId: string,
customerOrderId: string,
vendorId: string,
customerId: string,
newCustomerOrderStatus: CustomerOrderStatus // what the order was synced to
}
}

SLA_CUSTOMER_DECISION_EXPIRED — published by order-service SLA worker:

{
type: "SLA_CUSTOMER_DECISION_EXPIRED",
payload: {
vendorOrderId: string,
customerOrderId: string,
vendorId: string,
customerId: string,
autoAction: "accepted" // always auto-accepted (conservative: accept proposals = keep partial order)
}
}

SLA_DELIVERY_ACCEPTANCE_EXPIRED — published by delivery-service SLA worker:

{
type: "SLA_DELIVERY_ACCEPTANCE_EXPIRED",
payload: {
deliveryId: string,
customerOrderId: string,
customerId: string
}
}

SLA_COURIER_ASSIGNMENT_EXPIRED / SLA_COURIER_PICKUP_EXPIRED — similar patterns.

5.3 Enriching Existing Events with Deadlines

The SLA_TIMER_STARTED event is emitted from the SLA manager immediately after scheduling a BullMQ job. The WebSocket gateway already routes events to the correct client. No gateway modifications needed. The
notification-service subscribes to SLA events to send push notifications.

---

PART 6: QUEUE STRATEGY

6.1 BullMQ Architecture

Shared utility: shared/src/node/queues/sla-queue.ts

Redis: same instance as API gateway rate limiter
Queue naming: "sla:{service}:{sla_type}" - "sla:order:vendor_confirmation" - "sla:order:customer_decision" - "sla:delivery:acceptance" - "sla:delivery:assignment" - "sla:delivery:pickup"

Job deduplication via jobId:
jobId format: "{slaType}:{entityId}"
Examples:
"vendor_confirmation:vendor-order-uuid-123"
"courier_assignment:delivery-uuid-456"

BullMQ guarantees: if a job with the same jobId already exists in waiting or delayed state, the new add() call is a no-op. This means scheduling is idempotent — you can call
scheduleVendorConfirmationSla(vendorOrderId) multiple times safely.

Cancellation (when human acts before SLA fires):
await queue.remove(jobId); // BullMQ atomic removal

Worker configuration:
{
concurrency: 5, // 5 parallel job processors
removeOnComplete: 100, // keep last 100 completed jobs for debugging
removeOnFail: 200, // keep last 200 failed jobs for inspection
}

Failure handling:

- First failure: retry after 30 seconds (BullMQ exponential backoff)
- After 3 attempts: move to failed state, emit alert log
- No retries if job throws a non-retriable error (e.g., order already COMPLETED)

  6.2 BullMQ vs RabbitMQ for SLA Jobs

┌────────────────────────────┬──────────────────────────────┬────────────────────────────┐
│ Concern │ RabbitMQ DLX/TTL │ BullMQ (Redis) │
├────────────────────────────┼──────────────────────────────┼────────────────────────────┤
│ Cancellability │ Hard (no per-message cancel) │ Easy (queue.remove(jobId)) │
├────────────────────────────┼──────────────────────────────┼────────────────────────────┤
│ Precision │ Seconds-level drift │ Millisecond precision │
├────────────────────────────┼──────────────────────────────┼────────────────────────────┤
│ Deduplication │ No built-in │ Built-in via jobId │
├────────────────────────────┼──────────────────────────────┼────────────────────────────┤
│ Persistence across restart │ Yes │ Yes (Redis persistence) │
├────────────────────────────┼──────────────────────────────┼────────────────────────────┤
│ Already in stack │ Yes │ Redis already deployed │
├────────────────────────────┼──────────────────────────────┼────────────────────────────┤
│ Ecosystem │ Mature │ Mature │
└────────────────────────────┴──────────────────────────────┴────────────────────────────┘

BullMQ wins on cancellability alone — this is the most important property for SLA timers (you need to cancel when the vendor responds in time).

---

PART 7: SCALABILITY STRATEGY

7.1 Horizontal Scaling Safety

BullMQ uses Redis as a distributed lock store. Multiple instances of order-service all connect to the same Redis queue. BullMQ's BRPOPLPUSH (atomic pop) ensures only one worker instance picks up each job. No
custom leader election needed.

7.2 SLA Configuration

SLA durations should NOT be hardcoded. They should be environment variables in config/env.ts:

VENDOR_CONFIRMATION_SLA_MINUTES=10
CUSTOMER_DECISION_SLA_MINUTES=15
DELIVERY_ACCEPTANCE_SLA_MINUTES=5
COURIER_ASSIGNMENT_SLA_MINUTES=5
COURIER_PICKUP_SLA_MINUTES=30

Later these can be moved to a configuration service or database table (e.g., per-vendor SLA tiers for premium vendors), without changing the core scheduling code.

7.3 Future Admin Dashboard Support

The deadline columns in the DB enable:

- GET /admin/orders?sla_breach_risk=true — orders approaching deadline
- SLA breach rate metrics per vendor
- Average vendor response time analytics

These can be added in Phase 4+ without any schema changes.

---

PART 8: CANCELLATION CASCADE DESIGN

When a vendor order expires and is auto-cancelled, the cascade must be correct:

VendorOrder A: PENDING → SLA fires → CANCELLED
↓
syncCustomerOrderStatus(): - If ALL vendor orders are CANCELLED: CustomerOrder → CANCELLED + Publish ORDER_CANCELLED + Publish ORDER_STOCK_RELEASE_REQUESTED (all stock freed) + Delivery (if somehow created) → FAILED

    - If SOME vendor orders CANCELLED, rest are PENDING/CONFIRMED:
      CustomerOrder stays in PENDING_VENDOR_CONFIRMATION
      (Remaining vendors still have their SLA running)

    - If remaining non-cancelled vendors all CONFIRMED:
      CustomerOrder → READY (normal flow resumes)

For customer decision SLA expiry (auto-accept proposals):
VendorOrder: PROPOSAL_SENT → SLA fires
→ Accept all PENDING proposals for this vendor order
→ VendorOrder → CONFIRMED
→ syncCustomerOrderStatus() runs normally
→ If all confirmed → CustomerOrder → READY → delivery created

For delivery acceptance SLA expiry:
Delivery: PENDING → acceptance SLA fires
→ Delivery → FAILED
→ Publish SLA_DELIVERY_ACCEPTANCE_EXPIRED
→ Order-service receives event → CustomerOrder could be re-notified to delivery managers
→ Or: auto-re-create delivery after a backoff

The re-creation path (retry PENDING delivery) is important for production. A simple strategy: on SLA_DELIVERY_ACCEPTANCE_EXPIRED, order-service publishes ORDER_READY again (or a new DELIVERY_RETRY_REQUESTED
event), which triggers a new delivery creation. This needs careful idempotency (check that no PENDING delivery already exists).

---

PART 9: FRONTEND COUNTDOWN SUPPORT

9.1 Real-time Countdown Delivery

The frontend (vendor dashboard, customer app) needs the deadline timestamp to render a countdown. Two mechanisms:

Mechanism 1: SLA_TIMER_STARTED WebSocket event

- When an SLA is scheduled, a SLA_TIMER_STARTED event is published to RabbitMQ
- WebSocket gateway routes it to the affected vendor/customer/manager
- Frontend receives { slaType, entityId, deadline } and starts a local countdown

Mechanism 2: Deadline embedded in existing event payloads

- When VENDOR_ORDER_CREATED is published, include vendorConfirmationDeadline in the payload
- When VENDOR_ORDER_PROPOSED is published, include customerDecisionDeadline in the payload
- Frontend extracts deadline from the event it already receives

Both mechanisms are needed: Mechanism 2 for initial state on connection, Mechanism 1 for mid-session timer resets.

9.2 HTTP Endpoint for Page Load

When a vendor opens their order dashboard (not through WebSocket), they need the current deadline:

GET /vendor-orders/:id → response includes { vendorConfirmationDeadline, customerDecisionDeadline }
GET /deliveries/:id → response includes { acceptanceDeadline, assignmentDeadline, pickupDeadline }

The deadline columns in the DB make this trivial — the repositories already return the full entity.

9.3 Clock Skew Handling

The frontend must use the server's deadline timestamp (not durationSeconds) to avoid clock skew. The mobile/web app should compute remainingMs = deadline - Date.now() — if the server and client clocks differ
by more than a few seconds, the countdown will be slightly off. A /health endpoint that returns server time can be used for clock calibration if needed.

---

PART 10: IMPLEMENTATION ROADMAP

---

PHASE 1 — Foundation (No Business Logic Changes)

Goal: Add BullMQ infrastructure without touching any existing flows.

Files to change/create:

1. shared/src/node/queues/sla-queue.ts (new)


    - SlaQueue class wrapping BullMQ Queue
    - SlaWorker class wrapping BullMQ Worker
    - Typed job data interfaces: SlaJobData { entityId, entityType, slaType, scheduledAt }
    - Exports: createSlaQueue(name, redisConfig), createSlaWorker(name, handler, redisConfig)

2. shared/src/node/index.ts (modify)


    - Export SlaQueue, SlaWorker, SlaJobData from new file

3. shared/src/events/event-types.ts (modify)


    - Add: SLA_VENDOR_CONFIRMATION_EXPIRED, SLA_CUSTOMER_DECISION_EXPIRED, SLA_DELIVERY_ACCEPTANCE_EXPIRED, SLA_COURIER_ASSIGNMENT_EXPIRED, SLA_COURIER_PICKUP_EXPIRED, SLA_TIMER_STARTED

4. services/order-service/src/config/env.ts (modify)


    - Add: REDIS_URL, VENDOR_CONFIRMATION_SLA_MINUTES, CUSTOMER_DECISION_SLA_MINUTES

5. services/delivery-service/src/config/env.ts (modify)


    - Add: REDIS_URL, DELIVERY_ACCEPTANCE_SLA_MINUTES, COURIER_ASSIGNMENT_SLA_MINUTES, COURIER_PICKUP_SLA_MINUTES

6. docker-compose.yml — verify REDIS_URL is forwarded to order-service and delivery-service containers

Risks: None — purely additive
Dependencies: None
Tests: BullMQ queue connect/disconnect unit tests

---

PHASE 2 — Database Migrations

Goal: Add deadline columns to both services' schemas.

Files to change:

1. services/order-service/src/infrastructure/database/schema.sql (modify)


    - Add vendor_confirmation_deadline TIMESTAMP NULL + index to vendor_orders
    - Add customer_decision_deadline TIMESTAMP NULL + index to vendor_orders

2. services/delivery-service/src/infrastructure/database/schema.sql (modify)


    - Add acceptance_deadline TIMESTAMP NULL + index to deliveries
    - Add assignment_deadline TIMESTAMP NULL + index to deliveries
    - Add pickup_deadline TIMESTAMP NULL + index to deliveries

3. services/order-service/src/core/entities/vendor-order.entity.ts (modify)


    - Add vendorConfirmationDeadline?: Date, customerDecisionDeadline?: Date

4. services/delivery-service/src/core/entities/delivery.entity.ts (modify)


    - Add acceptanceDeadline?: Date, assignmentDeadline?: Date, pickupDeadline?: Date

5. Both repository implementations (modify)


    - Update SQL INSERT/SELECT/UPDATE to include new columns
    - Add findExpiredPendingVendorOrders(), findExpiredProposalVendorOrders() (for startup recovery)
    - Add findExpiredPendingDeliveries(), findExpiredAcceptedDeliveries(), findExpiredAssignedDeliveries()

6. Both repository interfaces (modify)


    - Add the new method signatures

Risks: Column additions are backward-compatible (NULL default, no existing logic depends on them)
Dependencies: Phase 1 complete
Tests: Repository unit tests with mock DB; verify NULL defaults work

---

PHASE 3 — Vendor SLA (Order Service)

Goal: Vendors have 10 minutes to respond. Auto-cancel on expiry.

Files to change/create:

1. services/order-service/src/application/services/order-sla.manager.ts (new)


    - scheduleVendorConfirmationSla(vendorOrderId, vendorId, customerOrderId, customerId) → sets deadline in DB + enqueues BullMQ job
    - cancelVendorConfirmationSla(vendorOrderId) → removes BullMQ job
    - scheduleCustomerDecisionSla(vendorOrderId, vendorId, customerOrderId, customerId) → similarly
    - cancelCustomerDecisionSla(vendorOrderId)
    - On startup: calls recovery scan (query expired + re-enqueue future ones)

2. services/order-service/src/application/workers/sla.worker.ts (new)


    - handleVendorConfirmationExpired(job): transaction + row lock + check status is still PENDING/PREPARING → cancel vendor order → sync customer order → publish SLA_VENDOR_CONFIRMATION_EXPIRED
    - handleCustomerDecisionExpired(job): transaction + lock → check status is still PROPOSAL_SENT → accept all pending proposals → sync → publish SLA_CUSTOMER_DECISION_EXPIRED

3. services/order-service/src/application/services/order-state.manager.ts (modify)


    - In syncCustomerOrderStatus(): after a vendor order transitions to CONFIRMED, call slaManager.cancelVendorConfirmationSla(vendorOrderId) and slaManager.cancelCustomerDecisionSla(vendorOrderId)
    - When VendorOrder → PENDING: call slaManager.scheduleVendorConfirmationSla(...)
    - When VendorOrder → PROPOSAL_SENT: call slaManager.scheduleCustomerDecisionSla(...) + cancelVendorConfirmationSla

4. services/order-service/src/infrastructure/messaging/OrderPublisher.ts (modify)


    - Add publishSlaVendorConfirmationExpired(payload), publishSlaCustomerDecisionExpired(payload), publishSlaTimerStarted(payload)

5. services/order-service/src/app.ts (modify)


    - Instantiate OrderSlaManager and SlaWorker
    - Remove the commented-out setInterval block
    - Run startup recovery scan

Risks:

- Must carefully test the cascade cancellation in multi-vendor orders
- scheduleVendorConfirmationSla called inside OrderCreationManager.create() — must happen after transaction commits (use the events-after-commit pattern already in the codebase)
- cancelVendorConfirmationSla must be called in every path that moves VendorOrder out of PENDING (vendor accepts, vendor cancels, vendor proposes)

Dependencies: Phases 1 + 2

---

PHASE 4 — Delivery SLA (Delivery Service)

Goal: Delivery offices and couriers have time-bounded windows. Auto-fail on expiry.

Files to change/create:

1. services/delivery-service/src/application/services/delivery-sla.manager.ts (new)


    - scheduleAcceptanceSla(deliveryId, customerId, customerOrderId) → sets acceptance_deadline + enqueues job
    - cancelAcceptanceSla(deliveryId)
    - scheduleAssignmentSla(deliveryId, ...) → sets assignment_deadline + enqueues job
    - cancelAssignmentSla(deliveryId)
    - schedulePickupSla(deliveryId, ...) → sets pickup_deadline + enqueues job
    - cancelPickupSla(deliveryId)
    - Startup recovery scan

2. services/delivery-service/src/application/workers/sla.worker.ts (new)


    - handleAcceptanceExpired: delivery PENDING → FAILED + publish SLA_DELIVERY_ACCEPTANCE_EXPIRED
    - handleAssignmentExpired: delivery ACCEPTED → PENDING (revert) + release office lock + publish SLA_COURIER_ASSIGNMENT_EXPIRED
    - handlePickupExpired: delivery ASSIGNED → un-assign courier (courier back to available) + publish SLA_COURIER_PICKUP_EXPIRED

3. services/delivery-service/src/application/services/delivery.service.ts (modify)


    - createDelivery(): call slaManager.scheduleAcceptanceSla(...) after creation (post-commit)
    - acceptDelivery(): call slaManager.cancelAcceptanceSla() + scheduleAssignmentSla()
    - assignCourier(): call slaManager.cancelAssignmentSla() + schedulePickupSla()
    - updateDeliveryStatus(PICKED_UP): call slaManager.cancelPickupSla()
    - updateDeliveryStatus(DELIVERED): cancel all remaining SLAs
    - Uncomment and refactor cancelExpiredAssignedDeliveries() → now powered by BullMQ instead of polling

4. services/delivery-service/src/infrastructure/messaging/DeliveryPublisher.ts (modify)


    - Add SLA event publish methods

5. services/delivery-service/src/app.ts (modify)


    - Instantiate DeliverySlaManager and SlaWorker
    - Remove commented-out setInterval block
    - Run startup recovery scan

Risks:

- handleAssignmentExpired: reverting ACCEPTED → PENDING means clearing delivery_office_id. Need a DB migration column or soft-revert strategy. Alternative: introduce a new PENDING_REASSIGNMENT status.
  Simpler: just set status back to PENDING and null out delivery_office_id — delivery managers can re-accept.
- handlePickupExpired: courier gets freed, but the delivery stays ASSIGNED with a courierId. Need to also null out courier_id and revert to ACCEPTED so a new courier can be assigned. The cancelled courier
  must be freed (set isAvailable = true).
- Both handlers must use row-locking transactions — same pattern as assignCourier() already does

Dependencies: Phases 1 + 2

---

PHASE 5 — Notifications & Socket Events

Goal: All parties receive timely alerts. Frontend gets countdown data.

Files to change:

1. services/notification-service/src/presentation/consumers/event.consumer.ts (modify)


    - Subscribe to: SLA_VENDOR_CONFIRMATION_EXPIRED → notify vendor ("Your order was cancelled due to inactivity") + notify customer
    - Subscribe to: SLA_CUSTOMER_DECISION_EXPIRED → notify customer ("Proposals were auto-accepted")
    - Subscribe to: SLA_DELIVERY_ACCEPTANCE_EXPIRED → notify delivery managers + customer
    - Subscribe to: SLA_COURIER_ASSIGNMENT_EXPIRED → notify delivery managers
    - Subscribe to: SLA_COURIER_PICKUP_EXPIRED → notify delivery managers + customer
    - Subscribe to: SLA_TIMER_STARTED → no push notification (data-only event for frontend)

2. Enrich existing event payloads (modify publishers)


    - VENDOR_ORDER_CREATED payload: add vendorConfirmationDeadline
    - VENDOR_ORDER_PROPOSED payload: add customerDecisionDeadline
    - DELIVERY_CREATED payload: add acceptanceDeadline
    - COURIER_ASSIGNED payload: add pickupDeadline

3. HTTP endpoint enrichment (modify controllers/services)


    - GET /vendor-orders/:id → response already includes full VendorOrder entity → add deadline fields
    - GET /deliveries/:id → response already includes full Delivery entity → add deadline fields

Risks: Low — purely additive
Dependencies: Phases 3 + 4

---

PHASE 6 — Observability & Admin Support

Goal: Metrics, dashboards, SLA breach alerting.

1. Structured logging in all SLA workers:


    - [SLA] BREACHED vendor_confirmation for vendor-order:xyz after 10min (vendor:abc)
    - [SLA] CANCELLED vendor_confirmation for vendor-order:xyz (vendor responded in 3.2min)

2. Admin API endpoint (add to admin-service or order-service):


    - GET /admin/orders/sla-status — orders with deadlines, their remaining time, breach risk
    - GET /admin/deliveries/sla-status — deliveries with acceptance/assignment/pickup SLA status

3. BullMQ dashboard (optional, Phase 6+):


    - Bull Board (@bull-board/express) can be mounted on a /admin/queues route for visual queue inspection
    - Zero code change — just add the express middleware

Risks: Low
Dependencies: Phases 3–5

---

PART 11: CRITICAL IMPLEMENTATION DECISIONS SUMMARY

┌────────────────────────────────┬─────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────┐
│ Decision │ Chosen Approach │ Rationale │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Queue technology │ BullMQ (Redis) │ Cancellable, persisted, deduplicated, Redis already in stack │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ SLA ownership │ In-service (order-service, delivery-service) │ No circular dependencies, co-located with state machines │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Deadline storage │ DB columns (canonical) + BullMQ (execution) │ DB = recovery source of truth; BullMQ = precision timer │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Job deduplication │ BullMQ jobId = "{type}:{entityId}" │ Idempotent scheduling, survive restarts │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Race condition guard │ SELECT ... FOR UPDATE + status check at job start │ Already used in codebase, consistent pattern │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Cascade on vendor SLA breach │ Cancel vendor order → syncCustomerOrderStatus │ Reuses existing cascade logic exactly │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Customer decision SLA expiry │ Auto-accept proposals (conservative) │ Partial fulfillment better than full cancel for customer experience │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Delivery acceptance SLA expiry │ Fail delivery → re-trigger ORDER_READY │ Clean retry loop │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Frontend countdown │ deadline timestamps in event payloads + SLA_TIMER_STARTED event │ Works on reconnect + mid-session │
├────────────────────────────────┼─────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Startup recovery │ DB scan on boot → cancel breached + re-enqueue future │ Self-healing after Redis or service downtime │
└────────────────────────────────┴─────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────┘

---

PART 12: PRE-IMPLEMENTATION CHECKLIST

Before writing the first line of implementation code, verify:

- REDIS_URL is in docker-compose for order-service and delivery-service containers
- bullmq and ioredis are added to root package.json dependencies
- Confirm vendor_confirmation_deadline column migration runs without breaking existing seed data
- Confirm deliveries schema migration runs cleanly
- Confirm OrderSlaManager is injected into OrderStateManager without creating a circular dependency (use a setter or re-order the constructor chain)
- Confirm the startup recovery scan does not fire during DB initialization scripts (only in the running app server)
- Decide on the SLA_TIMER_STARTED event — does the WebSocket gateway broadcast it to all roles (ADMIN, DELIVERY_MANAGER) or only the specific party? It should be filtered to only the relevant party.

---

This analysis gives you the complete architectural foundation. Every decision maps directly to existing patterns in the codebase — the SLA system will read as if it was always part of the original design.
