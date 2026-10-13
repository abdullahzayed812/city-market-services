import { ForbiddenError, UserRole } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { VendorClient } from "../../infrastructure/http/vendor-client";

const vendorClient = new VendorClient();

// Whose catalog the caller may change. Returns the caller's store id for a VENDOR, which
// must be approved and active; null for an ADMIN or a service token (any store).
// Any other role is refused. Approval is enforced here, on the server, for every
// product / category write - hiding buttons in the apps is only a convenience.
export async function resolveWritableVendorId(req: AuthenticatedRequest): Promise<string | null> {
  if (req.authType === "service" && req.service) return null;
  const role = req.user?.role;
  if (role === UserRole.ADMIN) return null;
  if (role !== UserRole.VENDOR) throw new ForbiddenError("insufficient_permissions");

  const header = req.headers.authorization;
  const vendor = header ? await vendorClient.getOwnVendor(header) : null;
  if (!vendor) throw new ForbiddenError("vendor_profile_required");
  // MySQL BOOLEAN arrives as 0 / 1
  if (vendor.isActive != null && !vendor.isActive) throw new ForbiddenError("vendor_inactive");
  if (vendor.approvalStatus !== "APPROVED") throw new ForbiddenError("vendor_not_approved");
  return vendor.id;
}

// A VENDOR may only touch rows of their own store
export function assertOwnStore(ownVendorId: string | null, rowVendorId: string | null | undefined): void {
  if (ownVendorId && rowVendorId !== ownVendorId) throw new ForbiddenError("not_your_store");
}
