import { DeliveryStatus } from "@city-market/shared";
import { PickupLocation } from "../entities/pickup-location.entity"; // Import PickupLocation

export interface CreateDeliveryDto {
  customerOrderId: string;
  vendorOrderId?: string; // Keep this for now, though it might become less relevant.
  pickupLocations: PickupLocation[]; // New: List of pickup locations
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
