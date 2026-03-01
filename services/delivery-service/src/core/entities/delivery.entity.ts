import { DeliveryStatus } from "@city-market/shared";
import { PickupLocation } from "./pickup-location.entity"; // Import PickupLocation

export interface Delivery {
  id: string;
  customerId: string;
  customerOrderId: string;
  vendorOrderId?: string; // This will become less relevant if we have multiple pickup locations
  // But keep it for now as it's part of the unique constraint
  courierId?: string;
  status: DeliveryStatus;
  pickupLocations: PickupLocation[]; // New: List of pickup locations
  deliveryAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  notes?: string;
  courierName?: string;
  courierPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}
