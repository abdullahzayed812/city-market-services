import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AppType, BaseEvent, EventType, PlatformType, UserRole } from "@city-market/shared";
import { NotificationService, PushSender } from "../application/services/notification.service";
import { INotificationRepository } from "../core/interfaces/notification.repository";
import { DeviceToken, Notification, NotificationPreference } from "../core/entities/notification.entity";
import { AdminDirectory } from "../infrastructure/clients/admin-directory";

class FakeRepo implements INotificationRepository {
  notifications: Notification[] = [];
  prefs = new Map<string, NotificationPreference>();
  tokens: DeviceToken[] = [];

  async create(n: Notification) {
    if (n.dedupeKey && this.notifications.some((x) => x.userId === n.userId && x.dedupeKey === n.dedupeKey)) return false;
    this.notifications.push({ ...n });
    return true;
  }
  async findByUserId(userId: string, limit: number, offset: number) {
    return this.notifications.filter((n) => n.userId === userId).slice(offset, offset + limit);
  }
  async countAll(userId: string) {
    return this.notifications.filter((n) => n.userId === userId).length;
  }
  async markAsRead(userId: string, id: string) {
    const n = this.notifications.find((x) => x.id === id && x.userId === userId && !x.isRead);
    if (n) n.isRead = true;
    return !!n;
  }
  async markAllAsRead(userId: string) {
    const unread = this.notifications.filter((x) => x.userId === userId && !x.isRead);
    unread.forEach((n) => (n.isRead = true));
    return unread.length;
  }
  async countUnread(userId: string) {
    return this.notifications.filter((n) => n.userId === userId && !n.isRead).length;
  }
  async getPreferences(userId: string) {
    return this.prefs.get(userId) ?? null;
  }
  async upsertPreferences(p: NotificationPreference) {
    this.prefs.set(p.userId, p);
  }
  async addDeviceToken(t: DeviceToken) {
    this.tokens = this.tokens.filter((x) => !(x.token === t.token && x.userId !== t.userId));
    if (!this.tokens.some((x) => x.token === t.token && x.userId === t.userId)) this.tokens.push(t);
  }
  async removeDeviceToken(token: string) {
    this.tokens = this.tokens.filter((x) => x.token !== token);
  }
  async removeUserDeviceToken(userId: string, token: string) {
    this.tokens = this.tokens.filter((x) => !(x.token === token && x.userId === userId));
  }
  async getDeviceTokens(userId: string) {
    return this.tokens.filter((x) => x.userId === userId);
  }
  async getTokensByAppType(appType: string) {
    return this.tokens.filter((x) => x.appType === appType);
  }
}

class FakePush implements PushSender {
  sent: Array<{ tokens: string[]; title: string }> = [];
  async sendMulticast(tokens: string[], title: string) {
    this.sent.push({ tokens, title });
    return [];
  }
}

const ADMINS = ["admin-1", "admin-2"];
const directory: AdminDirectory = { listAdminUserIds: async () => ADMINS };

let repo: FakeRepo;
let push: FakePush;
let live: BaseEvent[];
let service: NotificationService;

beforeEach(() => {
  repo = new FakeRepo();
  push = new FakePush();
  live = [];
  service = new NotificationService(repo, push, async (e) => void live.push(e), directory);
});

const registerAdminPhone = (userId: string, token: string) =>
  service.registerDevice(userId, UserRole.ADMIN, token, PlatformType.ANDROID, AppType.ADMIN, "ar");

describe("admin notifications", () => {
  test("every admin gets one stored notification, a live event and a push", async () => {
    await registerAdminPhone("admin-1", "tok-1");
    const sent = await service.sendToAdmins(
      "ADMIN_VENDOR_REVIEW",
      "notification_admin_vendor_registered_title",
      "notification_admin_vendor_registered_message",
      { type: "ADMIN_VENDOR_REVIEW", vendorId: "v1", shopName: "Shop" },
      { dedupeKey: "VENDOR_REGISTERED:e1" },
    );
    assert.equal(sent, 2);
    assert.deepEqual(repo.notifications.map((n) => n.userId).sort(), ADMINS);
    assert.equal(repo.notifications[0].metadata.titleKey, "notification_admin_vendor_registered_title");
    assert.equal(repo.notifications[0].metadata.role, UserRole.ADMIN);
    assert.match(repo.notifications[0].message, /Shop/);
    assert.deepEqual(
      live.map((e) => [e.type, e.payload.userId]),
      ADMINS.map((id) => [EventType.NOTIFICATION_CREATED, id]),
    );
    // Only admin-1 has a device
    assert.equal(push.sent.length, 1);
    assert.deepEqual(push.sent[0].tokens, ["tok-1"]);
  });

  test("a redelivered event creates nothing and pushes nothing", async () => {
    await registerAdminPhone("admin-1", "tok-1");
    const args = ["ADMIN_DELIVERY_ISSUE", "t", "m", { deliveryId: "d1" }, { dedupeKey: "DELIVERY_FAILED:e9" }] as const;
    await service.sendToAdmins(...args);
    const again = await service.sendToAdmins(...args);
    assert.equal(again, 0);
    assert.equal(repo.notifications.length, 2);
    assert.equal(push.sent.length, 1);
    assert.equal(live.length, 2);
  });

  test("push: false stores the notification without a push", async () => {
    await registerAdminPhone("admin-1", "tok-1");
    await service.sendToAdmins("ADMIN_DELIVERY_ISSUE", "t", "m", {}, { dedupeKey: "k", push: false });
    assert.equal(repo.notifications.length, 2);
    assert.equal(push.sent.length, 0);
  });

  test("an admin who turned push off still gets the in-app notification", async () => {
    await registerAdminPhone("admin-1", "tok-1");
    await service.updatePreferences("admin-1", { pushEnabled: false });
    await service.sendToAdmins("ADMIN_OFFICE_REVIEW", "t", "m", {}, { dedupeKey: "k2" });
    assert.equal(repo.notifications.filter((n) => n.userId === "admin-1").length, 1);
    assert.equal(push.sent.length, 0);
    assert.deepEqual(await service.getPreferences("admin-1"), { pushEnabled: false });
  });

  test("a failing admin directory fails the event so it is retried", async () => {
    const failing = new NotificationService(repo, push, async () => {}, {
      listAdminUserIds: async () => {
        throw new Error("auth down");
      },
    });
    await assert.rejects(failing.sendToAdmins("X", "t", "m", {}, { dedupeKey: "k" }), /auth down/);
  });
});

describe("read state", () => {
  test("only the owner can mark a notification read, and their apps are told", async () => {
    const n = await service.sendNotification("admin-1", "X", "t", "m", {}, { dedupeKey: "a" });
    live = [];
    await service.markAsRead("admin-2", n!.id);
    assert.equal(repo.notifications[0].isRead, false);
    assert.equal(live.length, 0);

    await service.markAsRead("admin-1", n!.id);
    assert.equal(repo.notifications[0].isRead, true);
    assert.deepEqual(live.map((e) => [e.type, e.payload.userId, e.payload.ids]), [[EventType.NOTIFICATION_READ, "admin-1", [n!.id]]]);

    // Already read: no second live event
    await service.markAsRead("admin-1", n!.id);
    assert.equal(live.length, 1);
  });

  test("mark all read syncs once and the unread count drops to zero", async () => {
    await service.sendNotification("admin-1", "X", "t", "m", {}, { dedupeKey: "a" });
    await service.sendNotification("admin-1", "X", "t", "m", {}, { dedupeKey: "b" });
    live = [];
    await service.markAllRead("admin-1");
    assert.deepEqual(live.map((e) => e.payload), [{ userId: "admin-1", all: true }]);
    assert.equal((await service.getNotifications("admin-1")).unread, 0);
    await service.markAllRead("admin-1");
    assert.equal(live.length, 1);
  });
});

describe("devices", () => {
  test("only admins can register the admin app", async () => {
    await assert.rejects(
      service.registerDevice("cust-1", UserRole.CUSTOMER, "tok", PlatformType.ANDROID, AppType.ADMIN),
      (e: any) => e.statusCode === 403,
    );
    await assert.rejects(
      service.registerDevice("admin-1", UserRole.ADMIN, "tok", "PHONE" as PlatformType, AppType.ADMIN),
      (e: any) => e.statusCode === 400,
    );
  });

  test("a device moves to the account that signed in last, and sign-out removes it", async () => {
    await service.registerDevice("cust-1", UserRole.CUSTOMER, "shared", PlatformType.ANDROID, AppType.CUSTOMER);
    await registerAdminPhone("admin-1", "shared");
    assert.deepEqual(repo.tokens.map((t) => t.userId), ["admin-1"]);
    await service.unregisterDevice("admin-1", "shared");
    assert.equal(repo.tokens.length, 0);
  });
});
