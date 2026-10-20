import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "events";
import { BaseEvent, EventType } from "@city-market/shared";
import { adminChangePublisher, describeAdminChange } from "../presentation/middlewares/admin-change-publisher";

describe("describeAdminChange", () => {
  test("reads are not changes", () => {
    assert.equal(describeAdminChange("GET", "/vendors"), null);
    assert.equal(describeAdminChange("HEAD", "/vendors/1"), null);
  });

  test("resource, id and action come from the path", () => {
    assert.deepEqual(describeAdminChange("PATCH", "/vendors/v1/approval"), {
      resource: "vendors",
      resourceId: "v1",
      action: "approval",
      method: "PATCH",
      path: "/vendors/v1/approval",
    });
    assert.deepEqual(
      [describeAdminChange("POST", "/categories")?.action, describeAdminChange("POST", "/categories")?.resourceId],
      ["create", null],
    );
    assert.equal(describeAdminChange("DELETE", "/commission-tiers/t1")?.action, "delete");
    assert.equal(describeAdminChange("PATCH", "/categories/c1")?.action, "update");
    assert.equal(describeAdminChange("POST", "/users/register")?.action, "create");
    assert.equal(describeAdminChange("POST", "/global-products/bulk")?.resourceId, null);
    const paid = describeAdminChange("PATCH", "/delivery-settlements/courier/s9/mark-paid");
    assert.deepEqual([paid?.resource, paid?.resourceId, paid?.action], ["delivery-settlements", "s9", "mark-paid"]);
    const bulk = describeAdminChange("POST", "/vendors/v2/products/bulk-add-global");
    assert.deepEqual([bulk?.resourceId, bulk?.action], ["v2", "bulk-add-global"]);
  });
});

const run = async (method: string, path: string, statusCode: number) => {
  const published: BaseEvent[] = [];
  const middleware = adminChangePublisher(async (e) => void published.push(e));
  const res = Object.assign(new EventEmitter(), { statusCode }) as any;
  const req = { method, path, user: { userId: "admin-1" }, body: { password: "secret" } } as any;
  let nextCalled = false;
  middleware(req, res, () => (nextCalled = true));
  res.emit("finish");
  await new Promise((r) => setImmediate(r));
  return { published, nextCalled };
};

describe("adminChangePublisher", () => {
  test("a successful change publishes ADMIN_DATA_CHANGED with the actor and no body", async () => {
    const { published, nextCalled } = await run("POST", "/users/register", 201);
    assert.equal(nextCalled, true);
    assert.equal(published.length, 1);
    assert.equal(published[0].type, EventType.ADMIN_DATA_CHANGED);
    assert.equal(published[0].payload.resource, "users");
    assert.equal(published[0].payload.actorUserId, "admin-1");
    assert.ok(published[0].id);
    assert.doesNotMatch(JSON.stringify(published[0]), /secret/);
  });

  test("failed requests and reads publish nothing", async () => {
    assert.equal((await run("PATCH", "/vendors/v1/approval", 400)).published.length, 0);
    assert.equal((await run("DELETE", "/categories/c1", 500)).published.length, 0);
    const read = await run("GET", "/vendors", 200);
    assert.equal(read.published.length, 0);
    assert.equal(read.nextCalled, true);
  });
});
