import { CourierType } from "../entities/courier.entity";

export interface RegisterCourierDto {
  userId: string;
  fullName: string;
  phone: string;
  vehicleType?: string;
  licensePlate?: string;
  // Admin only; managers always create OFFICE couriers in their own office
  courierType?: CourierType;
  deliveryOfficeId?: string;
}

export interface RegisterFreelancerDto {
  fullName: string;
  phone: string;
  vehicleType?: string;
  licensePlate?: string;
  nationalIdUrl: string;
  licenseUrl?: string;
}

export interface UpdateCourierDto {
  fullName?: string;
  phone?: string;
  vehicleType?: string;
  licensePlate?: string;
}

export interface UpdateCourierLocationDto {
  latitude: number;
  longitude: number;
}
