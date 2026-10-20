import { EventType } from "../events/event-types.js";

/**
 * Real-time refresh rules shared by the admin dashboard and the admin mobile app.
 *
 * Socket events are only hints. A client maps each event to the query-key roots below and
 * invalidates them; the active queries then refetch the authoritative data with their current
 * filters and page (the filters are part of the key). Both clients use these key roots.
 */
export const AdminQueryKeys = {
  stats: "adminStats",
  orders: "adminOrders",
  order: "adminOrder",
  users: "adminUsers",
  userProfile: "adminUserProfile",
  vendors: "adminVendors",
  vendorsForTiers: "vendors",
  vendor: "adminVendor",
  vendorHistory: "vendorApprovalHistory",
  couriers: "adminCouriers",
  courierDetails: "adminCourierDetails",
  offices: "deliveryOffices",
  officesForFinance: "adminDeliveryOffices",
  officeDetails: "officeDetails",
  submissions: "productSubmissions",
  submission: "productSubmission",
  products: "adminProducts",
  globalProducts: "globalProducts",
  categories: "adminCategories",
  commissionTiers: "commissionTiers",
  deliveryFeeTiers: "deliveryFeeTiers",
  vendorPending: "vendorPendingEarnings",
  vendorSettlements: "vendorSettlements",
  courierPending: "courierPendingEarnings",
  courierSettlements: "courierSettlements",
  officePending: "officePendingEarnings",
  officeSettlements: "officeSettlements",
  deliveryOverview: "deliveryFinancialOverview",
  deliveryRatings: "deliveryRatings",
  vendorReviews: "vendorReviews",
  notifications: "adminNotifications",
} as const;

const K = AdminQueryKeys;

const ORDERS = [K.orders, K.order, K.stats];
const DELIVERY = [...ORDERS, K.couriers, K.courierDetails, K.officeDetails];
const DELIVERY_MONEY = [K.courierPending, K.courierSettlements, K.officePending, K.officeSettlements, K.deliveryOverview];
const VENDORS = [K.vendors, K.vendorsForTiers, K.vendor, K.vendorHistory, K.userProfile, K.stats];
const COURIERS = [K.couriers, K.courierDetails, K.userProfile, K.stats];
const OFFICES = [K.offices, K.officesForFinance, K.officeDetails, K.userProfile];
const SUBMISSIONS = [K.submissions, K.submission];
const PRODUCTS = [K.products, K.globalProducts];

/** Domain events (RabbitMQ → websocket-gateway → role:ADMIN) → query-key roots to refresh. */
export const ADMIN_EVENT_INVALIDATIONS: Partial<Record<EventType, readonly string[]>> = {
  [EventType.ORDER_CREATED]: ORDERS,
  [EventType.ORDER_CONFIRMED]: ORDERS,
  [EventType.ORDER_PREPARING]: ORDERS,
  [EventType.ORDER_CANCELLED]: [...ORDERS, K.products],
  [EventType.ORDER_READY]: ORDERS,
  [EventType.ORDER_AWAITING_CUSTOMER_CONFIRMATION]: ORDERS,
  [EventType.STOCK_RESERVED]: [...ORDERS, K.products],
  [EventType.STOCK_REJECTED]: ORDERS,
  [EventType.STOCK_FAILED]: ORDERS,
  [EventType.VENDOR_ORDER_CREATED]: ORDERS,
  [EventType.VENDOR_ORDER_CONFIRMED]: ORDERS,
  [EventType.VENDOR_ORDER_PROPOSED]: ORDERS,
  [EventType.VENDOR_ORDER_CANCELLED]: ORDERS,
  [EventType.PROPOSAL_ACCEPTED]: ORDERS,
  [EventType.PROPOSAL_REJECTED]: ORDERS,
  [EventType.SLA_VENDOR_CONFIRMATION_EXPIRED]: ORDERS,
  [EventType.SLA_CUSTOMER_DECISION_EXPIRED]: ORDERS,
  [EventType.SLA_VENDOR_CANCELLATION_DECISION_EXPIRED]: ORDERS,
  [EventType.DELIVERY_CREATED]: DELIVERY,
  [EventType.DELIVERY_ACCEPTED]: DELIVERY,
  [EventType.DELIVERY_CLAIMED]: DELIVERY,
  [EventType.DELIVERY_OPEN_TO_FREELANCE]: DELIVERY,
  [EventType.DELIVERY_RETURNED_TO_POOL]: DELIVERY,
  [EventType.DELIVERY_RELEASED_BY_COURIER]: DELIVERY,
  [EventType.DELIVERY_FAILED]: DELIVERY,
  [EventType.DELIVERY_CANCELLED_BY_COURIER]: DELIVERY,
  [EventType.COURIER_ASSIGNED]: DELIVERY,
  [EventType.ORDER_PICKED_UP]: DELIVERY,
  [EventType.ORDER_ON_THE_WAY]: DELIVERY,
  [EventType.ORDER_DELIVERED]: [...DELIVERY, ...DELIVERY_MONEY, K.vendorPending, K.deliveryRatings],
  [EventType.SLA_DELIVERY_ACCEPTANCE_EXPIRED]: DELIVERY,
  [EventType.SLA_COURIER_ASSIGNMENT_EXPIRED]: DELIVERY,
  [EventType.SLA_COURIER_PICKUP_EXPIRED]: DELIVERY,
  [EventType.USER_REGISTERED]: [K.users, K.stats],
  [EventType.VENDOR_REGISTERED]: [...VENDORS, K.users],
  [EventType.VENDOR_APPROVAL_UPDATED]: VENDORS,
  [EventType.VENDOR_STATUS_UPDATED]: VENDORS,
  [EventType.VENDOR_RATING_UPDATED]: [K.vendors, K.vendorReviews],
  [EventType.VENDOR_REVIEW_CREATED]: [K.vendors, K.vendorReviews],
  [EventType.LOW_STOCK]: [K.products],
  [EventType.PRODUCT_AVAILABILITY_CHANGED]: [K.products],
  [EventType.COURIER_REVIEW_REQUESTED]: COURIERS,
  [EventType.COURIER_APPROVAL_UPDATED]: COURIERS,
  [EventType.OFFICE_REVIEW_REQUESTED]: OFFICES,
  [EventType.OFFICE_APPROVAL_UPDATED]: OFFICES,
  [EventType.PRODUCT_SUBMISSION_CREATED]: SUBMISSIONS,
  [EventType.PRODUCT_SUBMISSION_REVIEWED]: [...SUBMISSIONS, ...PRODUCTS],
};

/** ADMIN_DATA_CHANGED `resource` (first admin-service path segment) → query-key roots. */
export const ADMIN_RESOURCE_INVALIDATIONS: Record<string, readonly string[]> = {
  users: [K.users, K.userProfile, K.stats],
  vendors: [...VENDORS, K.users, K.products],
  couriers: [...COURIERS, K.users],
  "delivery-offices": [...OFFICES, K.users],
  orders: ORDERS,
  "product-submissions": [...SUBMISSIONS, ...PRODUCTS],
  categories: [K.categories, K.products],
  products: [K.products],
  "global-products": PRODUCTS,
  "commission-tiers": [K.commissionTiers],
  "delivery-fee-tiers": [K.deliveryFeeTiers],
  settlements: [K.vendorSettlements, K.vendorPending],
  "delivery-settlements": DELIVERY_MONEY,
};

/** Query-key roots to refresh for one socket event (empty = nothing on screen depends on it). */
export const adminInvalidationsFor = (type: string, payload?: { resource?: string }): readonly string[] => {
  if (type === EventType.ADMIN_DATA_CHANGED) {
    return (payload?.resource && ADMIN_RESOURCE_INVALIDATIONS[payload.resource]) || [];
  }
  return ADMIN_EVENT_INVALIDATIONS[type as EventType] ?? [];
};

/** Every event an admin client should listen to (plus the personal notification events). */
export const ADMIN_REALTIME_EVENTS: readonly string[] = [
  ...Object.keys(ADMIN_EVENT_INVALIDATIONS),
  EventType.ADMIN_DATA_CHANGED,
];

/** Remembers recently seen event ids so a duplicate delivery is applied once. */
export class RecentEventIds {
  private ids = new Set<string>();
  constructor(private max = 500) {}

  /** true the first time an id is seen (events without an id are always new) */
  firstSeen(id: unknown): boolean {
    if (typeof id !== "string" || !id) return true;
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.max) {
      const oldest = this.ids.values().next().value as string;
      this.ids.delete(oldest);
    }
    return true;
  }
}

/** Where an admin notification leads, from its stored metadata. */
export type AdminNotificationTarget =
  | { screen: "vendor"; id: string }
  | { screen: "courier"; id: string }
  | { screen: "office"; id: string }
  | { screen: "submission"; id: string }
  | { screen: "order"; id: string }
  | null;

export const adminNotificationTarget = (metadata: Record<string, any> | null | undefined): AdminNotificationTarget => {
  if (!metadata) return null;
  switch (metadata.type) {
    case "ADMIN_VENDOR_REVIEW":
      return metadata.vendorId ? { screen: "vendor", id: metadata.vendorId } : null;
    case "ADMIN_COURIER_REVIEW":
      return metadata.courierId ? { screen: "courier", id: metadata.courierId } : null;
    case "ADMIN_OFFICE_REVIEW":
      return metadata.officeId ? { screen: "office", id: metadata.officeId } : null;
    case "ADMIN_PRODUCT_SUBMISSION":
      return metadata.submissionId ? { screen: "submission", id: metadata.submissionId } : null;
    case "ADMIN_DELIVERY_ISSUE":
    case "ADMIN_ORDER_ISSUE":
    case "ADMIN_NEW_ORDER":
    case "ADMIN_ORDER_CANCELLED":
      return metadata.customerOrderId ? { screen: "order", id: metadata.customerOrderId } : null;
    default:
      return null;
  }
};

/**
 * Unread notifications grouped by the screen they open, each with the distinct ids involved
 * (a merchant who resubmits twice is one item). Drives the tab badges, the review-hub counts and
 * the "new" dots in lists; opening an item marks its notifications read, which clears them.
 */
export type AdminUnreadSummary = Record<Exclude<AdminNotificationTarget, null>["screen"], string[]>;

export const emptyAdminUnreadSummary = (): AdminUnreadSummary => ({ vendor: [], courier: [], office: [], submission: [], order: [] });
