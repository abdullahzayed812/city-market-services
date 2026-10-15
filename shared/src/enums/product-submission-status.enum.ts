// A merchant's proposal for a new catalog (global) product. A submission is never sellable
// by itself: only an admin approval creates the global product (or links an existing one)
// and adds it to the merchant's store.
//   PENDING_REVIEW -> APPROVED | REJECTED | NEEDS_CHANGES   (admin)
//   NEEDS_CHANGES  -> PENDING_REVIEW                        (merchant resubmits)
//   PENDING_REVIEW | NEEDS_CHANGES -> CANCELLED             (merchant withdraws)
// APPROVED, REJECTED and CANCELLED are final.
export enum ProductSubmissionStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  NEEDS_CHANGES = "NEEDS_CHANGES",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

// How an approved submission was resolved
export enum ProductSubmissionResolution {
  // A new global product was created from the submission
  CREATED = "CREATED",
  // The admin found it already in the catalog and linked the merchant to that product
  LINKED_EXISTING = "LINKED_EXISTING",
}

export enum ProductSubmissionAction {
  SUBMITTED = "SUBMITTED",
  UPDATED = "UPDATED",
  RESUBMITTED = "RESUBMITTED",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
  APPROVED = "APPROVED",
  LINKED_EXISTING = "LINKED_EXISTING",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}
