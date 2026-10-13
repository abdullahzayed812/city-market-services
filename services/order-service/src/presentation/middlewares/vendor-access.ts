import { ForbiddenError, NotFoundError, UserRole } from "@city-market/shared";
import { AuthenticatedRequest, Logger } from "@city-market/shared/node";
import { config } from "../../config/env";

// The store whose orders the caller may see and act on. A VENDOR gets their own store's
// id, which must be approved and active (read live from vendor-service with the caller's
// token, so an admin's decision applies on the next request); ADMIN and service tokens get
// null (any store). Any other role is refused.
export async function resolveOwnVendorId(req: AuthenticatedRequest): Promise<string | null> {
  if (req.authType === "service" && req.service) return null;
  const role = req.user?.role;
  if (role === UserRole.ADMIN) return null;
  if (role !== UserRole.VENDOR) throw new ForbiddenError("insufficient_permissions");

  let vendor: { id?: string; approvalStatus?: string; isActive?: boolean | number } | undefined;
  try {
    const response = await fetch(`${config.vendorServiceUrl}/me`, { headers: { Authorization: req.headers.authorization || "" } });
    if (response.ok) vendor = ((await response.json()) as { data?: typeof vendor }).data;
  } catch (error: any) {
    Logger.error("Failed to reach vendor-service for /me", error?.message ?? error);
  }
  if (!vendor?.id) throw new ForbiddenError("vendor_profile_required");
  if (vendor.isActive != null && !vendor.isActive) throw new ForbiddenError("vendor_inactive");
  if (vendor.approvalStatus !== "APPROVED") throw new ForbiddenError("vendor_not_approved");
  return vendor.id;
}

// Customer-order actions: a CUSTOMER only on their own orders; ADMIN and service tokens
// (delivery, rating, admin, websocket gateway) on any. Anyone else, or a customer asking
// about someone else's order, gets the same 404 as a missing order, so ids can't be probed.
export function assertCustomerOrderAccess(req: AuthenticatedRequest, ownerId: string | null, notFoundKey = "order_not_found"): void {
  if (!ownerId) throw new NotFoundError(notFoundKey);
  if (req.authType === "service" && req.service) return;
  const user = req.user;
  if (user?.role === UserRole.ADMIN) return;
  if (user?.role === UserRole.CUSTOMER && user.userId === ownerId) return;
  throw new NotFoundError(notFoundKey);
}

export function assertOwnStore(ownVendorId: string | null, vendorId: string | undefined): void {
  if (ownVendorId && vendorId !== ownVendorId) throw new ForbiddenError("not_your_store");
}
