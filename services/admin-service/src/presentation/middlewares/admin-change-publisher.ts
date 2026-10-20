import { Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { BaseEvent, EventType } from "@city-market/shared";
import { AuthenticatedRequest, Logger } from "@city-market/shared/node";

export interface AdminChange {
  // First path segment, e.g. "vendors", "commission-tiers", "delivery-settlements"
  resource: string;
  // The id segment when the route has one (`/vendors/:id/approval` -> the vendor id)
  resourceId: string | null;
  // What was done: "create", "update", "delete" or the route's verb ("approval", "mark-paid", ...)
  action: string;
  method: string;
  path: string;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Path segments that are verbs or sub-collections, never ids
const NOT_IDS = new Set(["register", "bulk", "courier", "office", "vendor", "all-pending", "overview", "pending"]);

// Which admin data a mutating request touched; null for reads. Derived from the path only,
// never the body, so passwords and documents never reach the event or the audit log.
export const describeAdminChange = (method: string, path: string): AdminChange | null => {
  const verb = method.toUpperCase();
  if (!MUTATING.has(verb)) return null;
  const segments = path.split("?")[0].split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const [resource, ...rest] = segments;
  const idIndex = rest.findIndex((s) => !NOT_IDS.has(s));
  const resourceId = idIndex >= 0 ? rest[idIndex] : null;
  const trailing = idIndex >= 0 ? rest.slice(idIndex + 1) : [];
  const action =
    trailing.length > 0
      ? trailing[trailing.length - 1]
      : verb === "DELETE"
        ? "delete"
        : verb === "POST"
          ? "create"
          : "update";

  return { resource, resourceId, action, method: verb, path: "/" + segments.join("/") };
};

type Publish = (event: BaseEvent) => Promise<void>;

// After a successful (2xx) mutating admin request: one audit log line, and an ADMIN_DATA_CHANGED
// event so every admin's dashboard / app refreshes the affected screens. Publishing happens after
// the response, so a broker outage never fails or slows the admin's action.
export const adminChangePublisher =
  (publish: Publish) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const change = describeAdminChange(req.method, req.path);
    if (!change) return next();

    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const actorUserId = req.user?.userId ?? null;
      Logger.info("Admin action", { actorUserId, ...change, status: res.statusCode });
      publish({
        id: randomUUID(),
        type: EventType.ADMIN_DATA_CHANGED,
        timestamp: new Date(),
        payload: { ...change, actorUserId },
      }).catch((err) => Logger.warn(`ADMIN_DATA_CHANGED publish failed: ${err?.message}`));
    });
    next();
  };
