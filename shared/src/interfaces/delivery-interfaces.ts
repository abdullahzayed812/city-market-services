import { DeliveryStatus } from "../enums/delivery-status";

export interface PickupLocation {
  id: string;
  vendorOrderId: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

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
  itemsCount: number;
  assignedAt?: Date;
  assignedWindowExpiry?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  notes?: string;
  courierName?: string;
  courierPhone?: string;
  customerPhone?: string;
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
  isAvailable: boolean;
  isActive: boolean;
  rating: number;
  totalDeliveries: number;
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
