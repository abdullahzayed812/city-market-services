export interface PickupLocation {
  id: string; // Will be generated
  deliveryId?: string; // Will be set by service
  vendorOrderId: string;
  address: string;
  latitude: number;
  longitude: number;
}
