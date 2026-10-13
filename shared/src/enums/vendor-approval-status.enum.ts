// Merchant onboarding. Self-registered merchants start PENDING_REVIEW; vendors created by
// an admin (or seeds) start APPROVED. Only APPROVED merchants may run their shop.
// REJECTED merchants can correct their application and resubmit (back to PENDING_REVIEW).
export enum VendorApprovalStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
}
