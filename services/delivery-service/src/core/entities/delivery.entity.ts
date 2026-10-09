import { DeliveryStatus } from "@city-market/shared";
import { PickupLocation } from "./pickup-location.entity"; // Import PickupLocation

export type FulfillmentType = "OFFICE" | "FREELANCE";

export interface Delivery {
  id: string;
  customerId: string;
  customerOrderId: string;
  vendorOrderId?: string; // This will become less relevant if we have multiple pickup locations
  // But keep it for now as it's part of the unique constraint
  courierId?: string;
  deliveryOfficeId?: string | null;
  fulfillmentType?: FulfillmentType | null;
  status: DeliveryStatus;
  deliveryFee: number;
  feeTierId?: string | null;
  courierFeePercentage?: number | null;
  courierFeeAmount: number;
  officeFeeAmount: number;
  platformFeeAmount: number;
  cashCollectedAmount: number;
  openToFreelanceAt?: Date | null;
  pickupLocations: PickupLocation[];
  deliveryAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  totalPrice: number;
  itemsCount: number;
  officeSettlementId?: string;
  courierSettlementId?: string;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  notes?: string;
  acceptanceDeadline?: Date;
  assignmentDeadline?: Date;
  pickupDeadline?: Date;
  courierName?: string;
  courierPhone?: string;
  courierVehicleType?: string;
  courierLicensePlate?: string;
  customerPhone?: string;
  vendorOrders?: any[]; // Added to include items
  createdAt: Date;
  updatedAt: Date;
}
