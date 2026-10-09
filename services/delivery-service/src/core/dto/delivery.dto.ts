import { DeliveryStatus } from "@city-market/shared";
import { PickupLocation } from "../entities/pickup-location.entity"; // Import PickupLocation

export interface CreateDeliveryDto {
  customerId: string;
  customerOrderId: string;
  vendorOrderId?: string;
  pickupLocations: PickupLocation[]; // New: List of pickup locations
  deliveryAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  totalPrice?: number;
  itemsCount?: number;
  deliveryFee?: number;
  // Fee split is computed on accept/claim; creation only snapshots the tier
  feeTierId?: string | null;
  openToFreelanceAt?: Date | null;
}

export interface AssignCourierDto {
  courierId: string;
}

export interface UpdateDeliveryStatusDto {
  status: DeliveryStatus;
  notes?: string;
}
