// ── Enums ────────────────────────────────────────────────────────────────────

export enum MeasurementType {
  UNIT = "UNIT",
  WEIGHT = "WEIGHT",
}

export enum VendorOrderStatus {
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  READY = "READY",
  PICKED_UP = "PICKED_UP",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum CustomerOrderStatus {
  PENDING_VENDOR_CONFIRMATION = "PENDING_VENDOR_CONFIRMATION",
  WAITING_CUSTOMER_DECISION = "WAITING_CUSTOMER_DECISION",
  READY = "READY",
  IN_DELIVERY = "IN_DELIVERY",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum VendorType {
  Supermarket = "Supermarket",
  Bakery = "Bakery",
  Butcher = "Butcher",
  VegFruit = "VegFruit",
  Pharmacy = "Pharmacy",
  Poultry = "Poultry",
  Fish = "Fish",
  Roastery = "Roastery",
  Pastry = "Pastry",
  Stationery = "Stationery",
}

// ── Core Models ──────────────────────────────────────────────────────────────

export interface User {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

export interface Customer {
  id: string;
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  hasPenalty?: boolean;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface CreateAddressDto {
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface Vendor {
  id: string;
  shopName: string;
  shopDescription?: string;
  type: VendorType | string;
  storeImage?: string;
  isOpen?: boolean;
  rating?: number;
  reviewCount?: number;
  minOrderAmount?: number;
  estimatedDeliveryTime?: number;
  address?: string;
}

export interface Category {
  id: string;
  name: string;
  imageUrl?: string;
  color?: string;
  isGlobal?: boolean;
  vendorId?: string;
}

export interface VendorProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  measurementType: MeasurementType;
  stockQuantity?: number;
  stockWeightGrams?: number;
  vendorId: string;
  vendorName?: string;
  categoryId?: string;
  globalCategoryName?: string;
  isAvailable?: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  weight?: number;
  weightGrams?: number;
  vendorId: string;
  measurementType: MeasurementType;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface VendorOrderItem {
  id: string;
  productName: string;
  quantity?: number;
  proposedQuantity?: number;
  requestedWeightGrams?: number;
  actualWeightGrams?: number;
  totalPrice: number;
}

export interface OrderItemProposal {
  id: string;
  vendorOrderItemId: string;
  type: string;
  actualQuantity?: number;
  proposedQuantity?: number;
  originalQuantity?: number; // Sometimes used for mapping
  requestedWeightGrams?: number;
  proposedWeightGrams?: number;
  proposedWeight?: number;
  requestedWeight?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  vendorName?: string;
  productName?: string;
  priceDifference?: number;
}

export interface VendorOrder {
  id: string;
  vendorId: string;
  vendorName?: string;
  status: VendorOrderStatus | string;
  cancellationReason?: string;
  items: VendorOrderItem[];
  proposals?: OrderItemProposal[];
}

export interface OrderWithItems {
  order: {
    id: string;
    status: CustomerOrderStatus | string;
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
    deliveryAddress: string;
    createdAt: string;
    cancellationReason?: string;
  };
  vendorOrders?: VendorOrder[];
}

export interface CustomerOrder {
  id: string;
  status: CustomerOrderStatus | string;
  totalAmount: number;
  createdAt: string;
}

export interface CreateOrderDto {
  items: {
    vendorProductId: string;
    quantity?: number;
    weightGrams?: number;
  }[];
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface VendorRating {
  id: string;
  vendorId: string;
  orderId: string;
  stars: number;
  comment?: string;
  customerName?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface VendorProductFilter {
  vendorId?: string;
  categoryId?: string;
  globalCategoryId?: string;
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

// ── Notification / Realtime ───────────────────────────────────────────────────

/** FCM data payload fields sent from the backend */
export interface FcmData {
  notificationId?: string;
  type?: string;
  role?: string;
  orderId?: string;
  customerId?: string;
  vendorId?: string;
  vendorOrderId?: string;
  deliveryId?: string;
  ratingId?: string;
  customerName?: string;
  stars?: string;
  productName?: string;
  remaining?: string;
}

/** A notification that arrived in realtime (socket or foreground FCM) */
export interface LiveNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  timestamp: number;
}

/** Socket.IO event payload common fields */
export interface SocketEventPayload {
  customerId?: string;
  customerOrderId?: string;
  orderId?: string;
  vendorId?: string;
  vendorOrderId?: string;
  deliveryId?: string;
  [key: string]: unknown;
}

export type NotificationPermissionStatus = NotificationPermission | "unsupported";
