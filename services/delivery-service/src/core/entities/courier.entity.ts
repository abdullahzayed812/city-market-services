export interface Courier {
  id: string;
  userId: string;
  deliveryOfficeId?: string;
  fullName: string;
  phone: string;
  vehicleType?: string;
  licensePlate?: string;
  isAvailable: boolean;
  isActive: boolean;
  rating: number;
  totalDeliveries: number;
  createdAt: Date;
  updatedAt: Date;
}
