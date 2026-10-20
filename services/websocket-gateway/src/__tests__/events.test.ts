import "./setup-env";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EventType, UserRole } from "@city-market/shared";
import { createEventHandler } from "../events";

type Emit = { room: string; type: string; payload: any };

const fakeIo = () => {
  const emits: Emit[] = [];
  const io = { to: (room: string) => ({ emit: (type: string, payload: any) => void emits.push({ room, type, payload }) }) } as any;
  return { io, emits };
};

const ADMIN_ROOM = `role:${UserRole.ADMIN}`;

describe("event routing", () => {
  test("a notification reaches only its owner, never the admin room", async () => {
    const { io, emits } = fakeIo();
    await createEventHandler(io, async () => null)({
      id: "e1",
      type: EventType.NOTIFICATION_CREATED,
      payload: { userId: "cust-1", notification: { id: "n1", metadata: { orderId: "o1" } } },
    });
    assert.deepEqual(
      emits.map((e) => e.room),
      ["user:cust-1"],
    );
    assert.equal(emits[0].payload.eventId, "e1");
  });

  test("read-state sync goes to the owner's sockets only", async () => {
    const { io, emits } = fakeIo();
    await createEventHandler(io, async () => null)({ id: "e2", type: EventType.NOTIFICATION_READ, payload: { userId: "admin-1", all: true } });
    assert.deepEqual(emits.map((e) => e.room), ["user:admin-1"]);
  });

  test("admin changes go to admins only, with the event id", async () => {
    const { io, emits } = fakeIo();
    await createEventHandler(io, async () => null)({
      id: "e3",
      type: EventType.ADMIN_DATA_CHANGED,
      payload: { resource: "vendors", resourceId: "v1", vendorId: "v1", actorUserId: "admin-2" },
    });
    assert.deepEqual(emits.map((e) => [e.room, e.payload.eventId]), [[ADMIN_ROOM, "e3"]]);
  });

  test("domain events reach admins with an event id; the merchant room is unchanged", async () => {
    const { io, emits } = fakeIo();
    await createEventHandler(io, async () => null)({
      id: "e4",
      type: EventType.PRODUCT_SUBMISSION_REVIEWED,
      payload: { submissionId: "s1", vendorUserId: "vu-1", status: "APPROVED", note: "ok" },
    });
    const admin = emits.find((e) => e.room === ADMIN_ROOM);
    assert.equal(admin?.payload.eventId, "e4");
    const merchant = emits.find((e) => e.room === "user:vu-1");
    assert.deepEqual(merchant?.payload, { submissionId: "s1", status: "APPROVED" });
  });

  test("new review-queue events don't trigger an order lookup", async () => {
    const { io } = fakeIo();
    let lookups = 0;
    const handler = createEventHandler(io, async () => {
      lookups++;
      return null;
    });
    await handler({ id: "e5", type: EventType.PRODUCT_SUBMISSION_CREATED, payload: { submissionId: "s1" } });
    await handler({ id: "e6", type: EventType.OFFICE_REVIEW_REQUESTED, payload: { officeId: "o1" } });
    assert.equal(lookups, 0);
  });
});
