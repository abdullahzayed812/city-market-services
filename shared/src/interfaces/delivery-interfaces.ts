import { DeliveryStatus } from "../enums/delivery-status";

export interface PickupLocation {
  id: string;
  vendorOrderId: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export type CourierType = "OFFICE" | "FREELANCE";
export type CourierApprovalStatus = "PENDING_REVIEW" | "APPROVED" | "SUSPENDED" | "REJECTED";
export type FulfillmentType = "OFFICE" | "FREELANCE";

export interface Delivery {
  id: string;
  customerOrderId: string;
  vendorOrderId?: string;
  courierId?: string;
  deliveryOfficeId?: string;
  status: DeliveryStatus;
  pickupLocations: PickupLocation[];
  deliveryAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  totalPrice: number;
  deliveryFee?: number;
  itemsCount: number;
  acceptanceDeadline?: Date;
  assignmentDeadline?: Date;
  pickupDeadline?: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  notes?: string;
  courierName?: string;
  courierPhone?: string;
  customerPhone?: string;
  fulfillmentType?: FulfillmentType | null;
  courierFeeAmount?: number;
  cashCollectedAmount?: number;
  vendorOrders?: any[]; // Added to include items
  computedTotal?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Courier {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  deliveryOfficeId?: string | null;
  courierType?: CourierType;
  approvalStatus?: CourierApprovalStatus;
  nationalIdUrl?: string | null;
  licenseUrl?: string | null;
  isAvailable: boolean;
  isActive: boolean;
  rating: number;
  // How many customer ratings `rating` is based on (0 = no ratings yet)
  ratingCount?: number;
  totalDeliveries: number;
  cancellationCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeliveryDto {
  customerOrderId: string;
  vendorOrderId?: string;
  pickupLocations: PickupLocation[];
  deliveryAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
}

export interface AssignCourierDto {
  courierId: string;
}

export interface UpdateDeliveryStatusDto {
  status: DeliveryStatus;
  vendorOrderId: string;
  notes?: string;
}

export interface RegisterCourierDto {
  userId: string;
  fullName: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
}
