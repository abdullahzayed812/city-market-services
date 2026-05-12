Now I have a complete picture of the existing codebase. Here is the full architectural analysis.

---

City Market – Delivery Flow Refactor: Full Architectural Analysis

---

1. Business Flow Changes Required

Current Flow (Simplified)

Order Ready → Delivery Created (PENDING)
→ Office Accepts (ACCEPTED)
→ Courier Assigned (ASSIGNED)
→ Courier calls customer [manual, off-system]
→ Courier picks up (PICKED_UP)
→ On the way (ON_THE_WAY)
→ Delivered (DELIVERED)

New Flow

Order Ready → Delivery Created (PENDING)
→ Office Accepts (ACCEPTED)
→ Delivery Manager contacts customer [system-tracked]
→ Customer confirms availability (CUSTOMER_CONFIRMED)
→ Courier Assigned (ASSIGNED)
→ Courier picks up (PICKED_UP)
→ On the way (ON_THE_WAY)
→ Delivered (DELIVERED)

The confirmation gate moves from the courier, in the field, off-system to the delivery manager, pre-assignment, in-system. This is a fundamental shift in the business process: confirmation becomes a
prerequisite for assignment, not an implicit assumption after it.

---

2. State Transitions That Change

Current State Machine

PENDING → ACCEPTED → ASSIGNED → PICKED_UP → ON_THE_WAY → DELIVERED
↘ FAILED (any stage)

New State Machine

PENDING
→ ACCEPTED
→ CUSTOMER_CONFIRMED ← NEW: delivery manager confirmed customer
→ ASSIGNED ← can now happen only after confirmation
→ PICKED_UP
→ ON_THE_WAY
→ DELIVERED
→ FAILED
→ FAILED ← customer unreachable / refused
→ FAILED ← office-level abort

Transition Table

┌────────────────────┬────────────────────┬────────────────────────────────────────────┬─────────────────────────────────────────────┐
│ From │ To │ Triggered by │ Guard │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ PENDING │ ACCEPTED │ Delivery manager │ delivery exists │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ ACCEPTED │ CUSTOMER_CONFIRMED │ Delivery manager │ customer reachable + confirmed │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ ACCEPTED │ FAILED │ Delivery manager │ customer unreachable / refused │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ CUSTOMER_CONFIRMED │ ASSIGNED │ Delivery manager │ courier available │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ ASSIGNED │ PICKED_UP │ Courier │ within assignment window │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ PICKED_UP │ ON_THE_WAY │ Courier │ — │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ ON_THE_WAY │ DELIVERED │ Courier │ — │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ ASSIGNED │ FAILED │ System (window expired) or courier rejects │ — │
├────────────────────┼────────────────────┼────────────────────────────────────────────┼─────────────────────────────────────────────┤
│ CUSTOMER_CONFIRMED │ ACCEPTED │ Delivery manager │ reassignment needed (courier not available) │
└────────────────────┴────────────────────┴────────────────────────────────────────────┴─────────────────────────────────────────────┘

The critical invariant: assignCourier() must reject if status is not CUSTOMER_CONFIRMED.

---

3. Responsibilities Shifting from Courier App to Delivery App

┌────────────────────────────────────────────────┬─────────────────────────────┬────────────────────────────────────┐
│ Responsibility │ Was │ Now │
├────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Contacting customer │ Courier (phone, off-system) │ Delivery Manager (in-app, tracked) │
├────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Recording contact attempt │ None │ Delivery App + DB │
├────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Confirming customer availability │ Courier implicit │ Delivery Manager explicit action │
├────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Deciding whether to proceed │ Courier │ Delivery Manager │
├────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ Optional: contacting courier before assignment │ None │ Delivery Manager │
└────────────────────────────────────────────────┴─────────────────────────────┴────────────────────────────────────┘

The Courier App retains: receiving assignment notification, pickup confirmation, transit updates, delivery completion.

---

4. APIs That Need Modification

New Endpoints (Delivery Service)

POST /deliveries/:id/confirm-customer
Body: { notes?: string, contactedVia?: 'PHONE' | 'WHATSAPP' }
Auth: DELIVERY_MANAGER
Effect: status ACCEPTED → CUSTOMER_CONFIRMED, creates confirmation_attempt record

POST /deliveries/:id/mark-customer-unreachable
Body: { reason: string, attemptCount: number }
Auth: DELIVERY_MANAGER
Effect: logs failed attempt, optionally transitions to FAILED or stays ACCEPTED for retry

GET /deliveries/:id/confirmation-attempts
Auth: DELIVERY_MANAGER | ADMIN
Returns: all call/confirmation attempts for a delivery

Modified Endpoints

POST /deliveries/:id/assign [MODIFIED]
Guard added: delivery.status must be CUSTOMER_CONFIRMED
Returns 409 if status is ACCEPTED (not yet confirmed)

PATCH /deliveries/:id/cancel-by-courier [SCOPE NARROWED]
Courier can still cancel but ONLY from ASSIGNED status
Confirmation/cancellation at ACCEPTED/CUSTOMER_CONFIRMED stage is Delivery Manager only

Removed Responsibility from Courier

The implicit "courier confirms by picking up" model is replaced by the explicit confirmation gate. No endpoint is added to Courier App — the PICKED_UP transition remains as-is, it just no longer carries
implicit confirmation semantics.

---

5. Event/Message Changes Between Services

New Events to Add to EventType enum

// shared/src/events/event-types.ts

CUSTOMER_CONFIRMED_BY_DELIVERY = "CUSTOMER_CONFIRMED_BY_DELIVERY",
CUSTOMER_UNREACHABLE = "CUSTOMER_UNREACHABLE",
DELIVERY_CONFIRMATION_ATTEMPTED = "DELIVERY_CONFIRMATION_ATTEMPTED",

Existing Events Unaffected

DELIVERY_CREATED, COURIER_ASSIGNED, ORDER_PICKED_UP, ORDER_ON_THE_WAY, ORDER_DELIVERED, DELIVERY_FAILED — all remain. Their semantics don't change.

What Consumes the New Events

┌────────────────────────────────┬──────────────────────────┬────────────────────────────────────────────────────────────────────────────────┐
│ Event │ Consumer │ Action │
├────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ CUSTOMER_CONFIRMED_BY_DELIVERY │ Notification Service │ Push to courier: "Delivery confirmed, prepare for assignment" │
├────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ CUSTOMER_CONFIRMED_BY_DELIVERY │ Order Service (optional) │ Update customer order status to CONFIRMED_FOR_DELIVERY (if that status exists) │
├────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ CUSTOMER_UNREACHABLE │ Notification Service │ Push to delivery manager: alert, escalation trigger │
└────────────────────────────────┴──────────────────────────┴────────────────────────────────────────────────────────────────────────────────┘

DeliveryPublisher additions

// delivery-service/src/infrastructure/messaging/DeliveryPublisher.ts

async publishCustomerConfirmed(payload: {
deliveryId: string;
customerOrderId: string;
customerId: string;
confirmedBy: string; // managerId
}): Promise<void>

async publishCustomerUnreachable(payload: {
deliveryId: string;
customerOrderId: string;
customerId: string;
attemptCount: number;
}): Promise<void>

---

6. Changes Per Service and App

Order Service

Minimal changes. The order service is upstream of delivery and doesn't need to know about confirmation. However:

- Consider adding DELIVERY_CONFIRMED as a CustomerOrderStatus if the customer app should reflect that their order has been confirmed for delivery. This is optional but improves customer UX.
- The cancelOrderDueToDeliveryFailure() method already exists and handles the case where delivery fails — it should be triggered if CUSTOMER_UNREACHABLE leads to a permanent FAILED delivery.

Delivery Service

Core changes:

1. New confirmCustomer() method in DeliveryService
2. New recordConfirmationAttempt() method
3. assignCourier() guard: reject unless CUSTOMER_CONFIRMED
4. New cron: expire deliveries stuck in ACCEPTED too long (customer never reached)
5. New aggregate/table: delivery_confirmation (see schema section)

// delivery.service.ts additions

async confirmCustomer(deliveryId: string, managerId: string, notes?: string): Promise<void> {
return this.db.withTransaction(async (conn) => {
const delivery = await this.deliveryRepo.findByIdWithLock(deliveryId, conn);
if (!delivery) throw new NotFoundError("delivery_not_found");
if (delivery.status !== DeliveryStatus.ACCEPTED)
throw new ValidationError("delivery_must_be_accepted_to_confirm_customer");

      await this.deliveryRepo.updateStatus(deliveryId, DeliveryStatus.CUSTOMER_CONFIRMED, conn);
      await this.confirmationRepo.create({
        deliveryId,
        confirmedBy: managerId,
        outcome: ConfirmationOutcome.CONFIRMED,
        notes,
        attemptedAt: new Date(),
      }, conn);

      await this.publisher.publishCustomerConfirmed({
        deliveryId,
        customerOrderId: delivery.customerOrderId,
        customerId: delivery.customerId,
        confirmedBy: managerId,
      });
    });

}

async recordFailedContactAttempt(deliveryId: string, managerId: string, reason: string): Promise<void> {
// Logs attempt, does not change delivery status
// After N attempts (configurable), transitions to FAILED
const attempts = await this.confirmationRepo.countAttempts(deliveryId);
await this.confirmationRepo.create({
deliveryId,
confirmedBy: managerId,
outcome: ConfirmationOutcome.UNREACHABLE,
notes: reason,
attemptedAt: new Date(),
});

    if (attempts + 1 >= MAX_CONFIRMATION_ATTEMPTS) {
      await this.deliveryRepo.updateStatus(deliveryId, DeliveryStatus.FAILED);
      await this.publisher.publishCustomerUnreachable({ deliveryId, ... });
    }

}

Courier Workflows

No new endpoints or events. Courier App removes:

- Any UI showing "call customer" instruction
- Any UI showing "confirm customer" action

Courier App receives earlier notification: when CUSTOMER_CONFIRMED_BY_DELIVERY is published, the notification service can notify the courier that they are about to be assigned, so they can be ready.

Vendor Workflows

No changes. The vendor's lifecycle ends at PREPARING → READY. The delivery confirmation happens downstream and is invisible to vendors.

---

7. Improved Delivery Lifecycle States

// shared/src/enums/delivery-status.ts

export enum DeliveryStatus {
PENDING = "PENDING", // Created, awaiting office acceptance
ACCEPTED = "ACCEPTED", // Office accepted, needs to contact customer
CUSTOMER_CONFIRMED = "CUSTOMER_CONFIRMED", // Customer reachable and confirmed ← NEW
ASSIGNED = "ASSIGNED", // Courier assigned, pickup window open
PICKED_UP = "PICKED_UP", // Courier at vendor, picked up order
ON_THE_WAY = "ON_THE_WAY", // In transit to customer
DELIVERED = "DELIVERED", // Terminal: success
FAILED = "FAILED", // Terminal: failure (any stage)
}

The state machine is now explicit about the verification step. CUSTOMER_CONFIRMED is the gate between "we accepted this delivery" and "we've committed to dispatching a courier."

---

8. Status Design Rationale

Use CUSTOMER_CONFIRMED (not WAITING_COURIER_ASSIGNMENT) for these reasons:

- CUSTOMER_CONFIRMED is a fact about what happened (confirmation was received).
- WAITING_COURIER_ASSIGNMENT is a description of what needs to happen next, which is implicit from CUSTOMER_CONFIRMED + no courierId.
- Fact-based status names are more stable: business rules about what "waiting for assignment" means can change, but "customer was confirmed" is immutable.

Reject DELIVERY_VERIFIED: too vague — verified what? By whom?

Recommended naming conventions:
Event names (past tense facts): CUSTOMER_CONFIRMED, ORDER_PICKED_UP, COURIER_ASSIGNED
Status names (current state): CUSTOMER_CONFIRMED, ASSIGNED, PICKED_UP
Command names (imperative): confirmCustomer(), assignCourier(), markPickedUp()

---

9. Edge Case Analysis

9.1 Customer Unreachable

Risk: Delivery stuck in ACCEPTED indefinitely.

Strategy:

- Track each contact attempt with timestamp in delivery_confirmation_attempts
- Configurable max attempts (e.g. 3) and cooldown between attempts (e.g. 15 min)
- After max attempts: auto-transition to FAILED, trigger cancelOrderDueToDeliveryFailure() in Order Service
- New cron job: expire ACCEPTED deliveries older than N hours (e.g. 4 hours) with zero confirmed attempts

  9.2 Courier Rejects Assignment

Current behavior: cancelDeliveryByCourier() handles this, transitions to FAILED.

New behavior: Since customer is already confirmed, don't go to FAILED — go back to CUSTOMER_CONFIRMED. The delivery manager can then reassign to a different courier.

async cancelByCourier(deliveryId: string, courierId: string): Promise<void> {
// ... validate ownership ...

    // NEW: instead of FAILED, go back to CUSTOMER_CONFIRMED
    await this.deliveryRepo.updateStatus(deliveryId, DeliveryStatus.CUSTOMER_CONFIRMED, conn);
    await this.deliveryRepo.unassignCourier(deliveryId, conn);       // courierId = null, assignedAt = null
    await this.courierRepo.updateAvailability(courierId, true, conn); // courier available again

    await this.publisher.publishCourierRejectedAssignment({ deliveryId, courierId });

}

This is the most important behavior change — it avoids cascading to order cancellation just because one courier rejected.

9.3 Delivery Timeout (Assignment Window Expires)

Current: cancelExpiredAssignedDeliveries() → FAILED.

New: Same transition to FAILED if in ASSIGNED, but also add a cron for CUSTOMER_CONFIRMED deliveries with no courier assigned after N minutes. These should trigger an alert to the delivery manager rather than
auto-failing, since the customer was confirmed — it is a logistics failure, not a customer failure.

9.4 Reassignment

With the new CUSTOMER_CONFIRMED status, reassignment is clean:
ASSIGNED → (courier rejects) → CUSTOMER_CONFIRMED → ASSIGNED (new courier)
No need to re-confirm customer. The confirmation record proves the customer is available and expecting delivery.

Race condition risk: Two managers simultaneously try to assign different couriers to the same CUSTOMER_CONFIRMED delivery. Fix: assignCourier() uses findByIdWithLock() inside a transaction. The second request
will see status = ASSIGNED and throw ValidationError("delivery_already_assigned").

9.5 Vendor Delay (Order Not Ready When Customer Confirmed)

Risk: Customer is confirmed, but vendor is still preparing. Courier is assigned prematurely and sits waiting.

Mitigation: The ACCEPTED → CUSTOMER_CONFIRMED transition should check the corresponding vendor order status via order service HTTP call. If vendor order is not in PREPARING or READY, the system should warn
(but not block — delivery manager may know context). Alternatively, only allow confirmation when order is READY.

9.6 Multiple Deliveries per Order (Multi-vendor)

Your current code handles this — one customer order can produce multiple deliveries (vendors > 2km apart). The confirmation flow applies per delivery, not per order. This means:

- Customer may be confirmed for delivery A but not delivery B
- Each delivery_confirmation record is tied to a deliveryId
- The customer app shows delivery timeline per delivery (or rolled up per order)

---

10. Database Schema Modifications

    10.1 delivery Table (add columns)

ALTER TABLE delivery ADD COLUMN (
customer_confirmed_at DATETIME NULL,
customer_confirmed_by VARCHAR(36) NULL, -- managerId FK to users
confirmation_notes TEXT NULL,
contact_attempt_count INT NOT NULL DEFAULT 0
);

10.2 New Table: delivery_confirmation_attempt

CREATE TABLE delivery_confirmation_attempt (
id VARCHAR(36) NOT NULL PRIMARY KEY,
delivery_id VARCHAR(36) NOT NULL,
attempted_by VARCHAR(36) NOT NULL, -- managerId
outcome ENUM(
'CONFIRMED',
'UNREACHABLE',
'REFUSED',
'WRONG_NUMBER',
'RESCHEDULED'
) NOT NULL,
contacted_via ENUM('PHONE', 'WHATSAPP', 'OTHER') NOT NULL DEFAULT 'PHONE',
notes TEXT NULL,
attempted_at DATETIME NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_delivery_id (delivery_id),
    INDEX idx_attempted_at (attempted_at),
    FOREIGN KEY (delivery_id) REFERENCES delivery(id) ON DELETE CASCADE

);

10.3 Modified delivery Reassignment Tracking

ALTER TABLE delivery ADD COLUMN (
reassignment_count INT NOT NULL DEFAULT 0,
last_courier_id VARCHAR(36) NULL -- previous courier before reassignment
);

10.4 New Table: delivery_status_log

For a complete audit trail of every status transition:

CREATE TABLE delivery_status_log (
id VARCHAR(36) NOT NULL PRIMARY KEY,
delivery_id VARCHAR(36) NOT NULL,
from_status VARCHAR(50) NULL, -- NULL for initial PENDING
to_status VARCHAR(50) NOT NULL,
changed_by VARCHAR(36) NULL, -- userId (NULL if system/cron)
changed_by_role VARCHAR(50) NULL,
reason TEXT NULL,
metadata JSON NULL, -- flexible: courierId, attemptId, etc.
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_delivery_id (delivery_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (delivery_id) REFERENCES delivery(id) ON DELETE CASCADE

);

10.5 Full Entity Shape (after changes)

export interface Delivery {
id: string;
customerOrderId: string;
vendorOrderId?: string;
customerId: string;
courierId?: string;
deliveryOfficeId?: string;
status: DeliveryStatus;

    // Location
    deliveryAddress:        string;
    deliveryLatitude:       number;
    deliveryLongitude:      number;
    pickupLocations:        PickupLocation[];

    // Financials
    deliveryFee:            number;
    courierFeePercentage:   number;
    courierFeeAmount:       number;
    officeFeeAmount:        number;

    // Confirmation fields (NEW)
    customerConfirmedAt?:   Date;
    customerConfirmedBy?:   string;
    confirmationNotes?:     string;
    contactAttemptCount:    number;

    // Assignment
    assignedAt?:            Date;
    assignedWindowExpiry?:  Date;
    reassignmentCount:      number;      // NEW
    lastCourierId?:         string;      // NEW

    // Timestamps
    pickedUpAt?:            Date;
    deliveredAt?:           Date;
    createdAt:              Date;
    updatedAt:              Date;

}

export interface DeliveryConfirmationAttempt {
id: string;
deliveryId: string;
attemptedBy: string;
outcome: ConfirmationOutcome;
contactedVia: ContactChannel;
notes?: string;
attemptedAt: Date;
}

export enum ConfirmationOutcome {
CONFIRMED = "CONFIRMED",
UNREACHABLE = "UNREACHABLE",
REFUSED = "REFUSED",
RESCHEDULED = "RESCHEDULED",
}

export enum ContactChannel {
PHONE = "PHONE",
WHATSAPP = "WHATSAPP",
OTHER = "OTHER",
}

---

11. Audit Logging Strategy

Two-tier approach:

Tier 1 — delivery_status_log (structural, queryable): Every status transition logged with actor, role, reason, metadata. This is for business queries: "how long did this delivery spend in ACCEPTED?", "which
manager confirmed the most deliveries today?"

Tier 2 — Application logger (operational): Your existing Logger.warn/info for debugging. Not for compliance.

Log every transition in the service layer:

// delivery.service.ts - wrap all status changes

private async logStatusTransition(
deliveryId: string,
from: DeliveryStatus | null,
to: DeliveryStatus,
changedBy: string | null,
changedByRole: string | null,
reason?: string,
metadata?: Record<string, any>,
conn?: PoolConnection,
): Promise<void> {
await this.statusLogRepo.create({
id: randomUUID(),
deliveryId,
fromStatus: from,
toStatus: to,
changedBy,
changedByRole,
reason,
metadata: metadata ? JSON.stringify(metadata) : null,
createdAt: new Date(),
}, conn);
}

Call this inside every updateStatus(), confirmCustomer(), assignCourier(), and cancelByCourier().

---

12. Event-Driven Architecture Improvements

Outbox Pattern (Recommended)

Problem: Your current code publishes RabbitMQ events inside transactions (or immediately after). If the publish fails after the DB commit, the event is lost. If the publish succeeds but the DB rolls back, you
get a ghost event.

Solution: Transactional Outbox

CREATE TABLE outbox_event (
id VARCHAR(36) NOT NULL PRIMARY KEY,
event_type VARCHAR(100) NOT NULL,
payload JSON NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
published_at DATETIME NULL,
INDEX idx_unpublished (published_at)
);

Within the transaction: insert into outbox_event. After commit: a background publisher polls WHERE published_at IS NULL and publishes to RabbitMQ. On success: sets published_at.

This guarantees at-least-once delivery with no phantom events. Your existing DeliveryPublisher becomes the background relay.

Event Ordering

Delivery events involving the same deliveryId should be consumed in order. RabbitMQ doesn't guarantee ordering across consumers. Add a sequenceNumber field to events and have consumers idempotently skip
already-processed sequence numbers (store in a processed_event table keyed on eventId).

---

13. UI Changes Required

Delivery App (Primary changes)

┌──────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────┐
│ Screen │ Change │
├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery List │ Add filter by ACCEPTED (needs confirmation) and CUSTOMER_CONFIRMED (ready to assign) │
├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery Detail │ Add "Confirm Customer" button (visible when status = ACCEPTED) │
├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery Detail │ Add "Customer Unreachable" button (visible when status = ACCEPTED) │
├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery Detail │ Show confirmation attempts log │
├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery Detail │ Show "Assign Courier" button only when status = CUSTOMER_CONFIRMED │
├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ Assign Courier Screen │ Remove any "remind courier to call customer" copy │
├──────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ New: Confirmation Screen │ Phone/WhatsApp selector, notes field, confirm/unreachable actions │
└──────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘

Courier App (Removals)

┌────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Screen │ Change │
├────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery Detail │ Remove "Call Customer" section/button │
├────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery Detail │ Remove "Confirm Customer" action │
├────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Delivery Detail │ Pickup button now the first action (no confirmation prerequisite) │
├────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Push notifications │ Update copy: "Order confirmed for delivery, await assignment" instead of "Call customer before pickup" │
└────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Customer App

Consider adding a status like "Delivery Team Confirmed Your Order" in the order timeline. Maps to CUSTOMER_CONFIRMED delivery status. This reassures customers their order is coming and they were reached.

---

14. Notification Changes

New Notifications

┌───────────────────────────────────────────┬───────────────────────────┬────────────────────────────────────────────────────────────────────────────┐
│ Trigger │ Target │ Message │
├───────────────────────────────────────────┼───────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ CUSTOMER_CONFIRMED_BY_DELIVERY │ Customer │ "Great news! Your order #X has been confirmed for delivery." │
├───────────────────────────────────────────┼───────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ CUSTOMER_CONFIRMED_BY_DELIVERY │ Courier (if pre-selected) │ "A delivery is being prepared for you. Stand by for assignment." │
├───────────────────────────────────────────┼───────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ CUSTOMER_UNREACHABLE (after max attempts) │ Delivery Manager │ "Could not reach customer for order #X after N attempts. Order cancelled." │
├───────────────────────────────────────────┼───────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ COURIER_ASSIGNED (unchanged) │ Courier │ "You have been assigned delivery #X." │
├───────────────────────────────────────────┼───────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ Status = ACCEPTED for > 1 hour │ Delivery Manager │ "Order #X still unconfirmed — customer not yet contacted." │
└───────────────────────────────────────────┴───────────────────────────┴────────────────────────────────────────────────────────────────────────────┘

Removed Notifications

- Any notification prompting courier to call customer.

---

15. Cron Job Updates

Existing: cancelExpiredAssignedDeliveries() — keep, runs every 60s

No change needed. Already handles ASSIGNED → FAILED when assignedWindowExpiry passes.

New: cancelExpiredAcceptedDeliveries()

async cancelExpiredAcceptedDeliveries(): Promise<void> {
// Find deliveries in ACCEPTED/CUSTOMER_CONFIRMED for too long with no progress
const staleAccepted = await this.deliveryRepo.findStaleAccepted(
ACCEPTED_EXPIRY_HOURS // e.g. 6 hours
);

    for (const delivery of staleAccepted) {
      await this.db.withTransaction(async (conn) => {
        const locked = await this.deliveryRepo.findByIdWithLock(delivery.id, conn);
        if (!locked) return;
        if (
          locked.status !== DeliveryStatus.ACCEPTED &&
          locked.status !== DeliveryStatus.CUSTOMER_CONFIRMED
        ) return;

        await this.deliveryRepo.updateStatus(delivery.id, DeliveryStatus.FAILED, conn);
        await this.logStatusTransition(delivery.id, locked.status, DeliveryStatus.FAILED, null, "SYSTEM", "Stale accepted delivery expired", conn);
      });
      // Trigger order service cancellation
    }

}

New: Alert Cron — alertUnconfirmedDeliveries()

Runs every 30 minutes. Finds deliveries in ACCEPTED with zero confirmation attempts in the last hour. Sends push to delivery manager. Does not change status.

---

16. Clean Architecture + DDD Design

Aggregate Boundary

Currently, delivery confirmation is an attribute on the Delivery entity. For the scale you're at, this is fine. But consider extracting it:

Option A (Recommended for now): Delivery aggregate owns confirmation
Delivery (aggregate root)
├── PickupLocation[] (value objects)
├── DeliveryConfirmationAttempt[] (child entities, lazy-loaded)
└── DeliveryStatusLog[] (child entities, lazy-loaded)

Option B (Future): Separate DeliveryConfirmation aggregate
Only needed if confirmation has its own lifecycle, versioning, or team ownership. Premature for now.

Domain Service: DeliveryConfirmationService

Extract the confirmation logic from DeliveryService into a focused domain service:

export class DeliveryConfirmationService {
constructor(
private deliveryRepo: IDeliveryRepository,
private confirmationRepo: IDeliveryConfirmationRepository,
private publisher: DeliveryPublisher,
private db: Database,
) {}

    async confirmCustomer(deliveryId: string, managerId: string, dto: ConfirmCustomerDto): Promise<void>
    async recordAttempt(deliveryId: string, managerId: string, dto: RecordAttemptDto): Promise<void>
    async getAttempts(deliveryId: string): Promise<DeliveryConfirmationAttempt[]>

}

DeliveryService delegates to this service, keeping it focused on lifecycle management.

---

17. Backward-Compatible Migration Strategy

Phase 1: Schema migration (zero downtime)

-- All new columns are nullable with defaults — no existing rows break
ALTER TABLE delivery
ADD COLUMN customer_confirmed_at DATETIME NULL,
ADD COLUMN customer_confirmed_by VARCHAR(36) NULL,
ADD COLUMN contact_attempt_count INT NOT NULL DEFAULT 0,
ADD COLUMN reassignment_count INT NOT NULL DEFAULT 0;

CREATE TABLE delivery_confirmation_attempt ( ... );
CREATE TABLE delivery_status_log ( ... );

Backfill: for all existing ASSIGNED/PICKED_UP/DELIVERED deliveries, you can insert a synthetic delivery_status_log entry and a synthetic delivery_confirmation_attempt with outcome = 'CONFIRMED', notes =
'migrated' to preserve auditability.

Phase 2: Deploy service with feature flag

Add CONFIRMATION_REQUIRED=true env var. When false, assignCourier() skips the status guard and behaves as before. This lets you deploy without breaking anything.

Phase 3: Deploy Delivery App update

New confirmation screens go live. Managers start using the confirmation flow.

Phase 4: Enable enforcement

Set CONFIRMATION_REQUIRED=true. From this point, assignCourier() rejects if not CUSTOMER_CONFIRMED.

Phase 5: Remove feature flag

Clean up the guard check.

---

18. RBAC / Permission Changes

┌────────────────────────┬──────────────────┬──────────────────────────────────────────────────────────────────┐
│ Action │ Current │ New │
├────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────┤
│ confirmCustomer │ N/A │ DELIVERY_MANAGER only │
├────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────┤
│ recordAttempt │ N/A │ DELIVERY_MANAGER only │
├────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────┤
│ getAttempts │ N/A │ DELIVERY_MANAGER, ADMIN │
├────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────┤
│ assignCourier │ DELIVERY_MANAGER │ DELIVERY_MANAGER (guard: status must be CUSTOMER_CONFIRMED) │
├────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────┤
│ cancelByCourier │ COURIER │ COURIER (narrowed: ASSIGNED only, returns to CUSTOMER_CONFIRMED) │
├────────────────────────┼──────────────────┼──────────────────────────────────────────────────────────────────┤
│ cancelDelivery (force) │ ADMIN │ ADMIN, DELIVERY_MANAGER (for unresolvable situations) │
└────────────────────────┴──────────────────┴──────────────────────────────────────────────────────────────────┘

Office scoping remains: DELIVERY_MANAGER can only confirm/assign within their deliveryOfficeId.

---

19. Delivery Confirmation as Separate Aggregate

Not recommended now. The confirmation record is a child of the Delivery aggregate. It does not have independent lifecycle, does not need to be transacted independently, and is always accessed through the
delivery.

When to extract it: If you add SLA tracking, multi-party confirmation (manager + supervisor), or confirmation dispute resolution. At that point, DeliveryConfirmation earns its own aggregate root with its own
repository, events, and bounded context boundary.

---

20. Real-World Logistics Best Practices

1. Idempotent confirmation. If a manager submits confirmCustomer twice (network retry), the second call should be a no-op, not an error. Check: if delivery.status === CUSTOMER_CONFIRMED, return early.

1. Confirmation TTL. A confirmed delivery that is not assigned within N minutes (e.g. 90 min) should revert to ACCEPTED or at minimum alert the manager. Customer availability is time-sensitive.

1. Contact attempt throttling. Don't allow attempts faster than 10 minutes apart. Prevents harassing customers. Enforce in the service layer, not just the UI.

1. Phone number masking. The UserHttpClient.getCustomerPhone() should return a masked or tokenized number for display in app. Raw phone numbers should only be dialed through a deep-link tel: handler, not
   stored in delivery app state.

1. Multi-delivery order coordination. For orders with two deliveries (multi-vendor), confirm customer once and mark both deliveries as CUSTOMER_CONFIRMED. The current architecture will require you to confirm
   per-delivery, which means calling the customer twice for the same order. Fix: add customerConfirmedAt as a soft propagation — when manager confirms one delivery on a customerOrderId, offer to auto-confirm all
   sibling deliveries.

1. Courier soft-acceptance before assignment. Your new flow allows delivery manager to optionally contact the courier before assignment. Model this as a pre_assignment_check_at timestamp on the delivery, not
   a new status. A new status for this would bloat the state machine; a timestamp is sufficient to record that the courier was pre-screened.

1. SLA dashboards. Track ACCEPTED → CUSTOMER_CONFIRMED time and CUSTOMER_CONFIRMED → ASSIGNED time per delivery office. These are the new KPIs for delivery operations. Expose an admin analytics endpoint that
   returns p50/p95 of these durations.

---

Summary of Key Decisions

┌────────────────────────────┬──────────────────────────────────────────────────────────┐
│ Decision │ Recommendation │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ New status name │ CUSTOMER_CONFIRMED │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Where confirmation lives │ Child entity of Delivery aggregate │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Courier rejection behavior │ Return to CUSTOMER_CONFIRMED, not FAILED │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Assignment guard │ Hard block: status must be CUSTOMER_CONFIRMED │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Migration strategy │ Feature flag + nullable columns (no downtime) │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Event reliability │ Transactional outbox for publishCustomerConfirmed │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Multi-vendor confirmation │ Propagate to sibling deliveries, single customer contact │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Cron additions │ Stale ACCEPTED expiry + unconfirmed alert cron │
└────────────────────────────┴──────────────────────────────────────────────────────────┘
