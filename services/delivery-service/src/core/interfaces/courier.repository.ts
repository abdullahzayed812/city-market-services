import { Courier, CourierApprovalStatus, CourierType } from "../entities/courier.entity";

export interface CourierListFilter {
  courierType?: CourierType;
  approvalStatus?: CourierApprovalStatus;
  // Case-insensitive substring of name or phone
  search?: string;
  isActive?: boolean;
}

export interface ICourierRepository {
  create(courier: Courier, connection?: any): Promise<Courier>;
  findById(id: string, connection?: any): Promise<Courier | null>;
  findByIdForUpdate(id: string, connection: any): Promise<Courier | null>;
  findByUserId(userId: string, connection?: any): Promise<Courier | null>;
  findAvailable(connection?: any): Promise<Courier[]>;
  findAvailableByOfficeId(deliveryOfficeId: string, connection?: any): Promise<Courier[]>;
  findAll(limit: number, offset: number, filter?: CourierListFilter, connection?: any): Promise<Courier[]>;
  countAll(filter?: CourierListFilter, connection?: any): Promise<number>;
  findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: any): Promise<Courier[]>;
  findActiveFreelancers(seenWithinMinutes: number, connection?: any): Promise<Courier[]>;
  update(id: string, data: Partial<Courier>, connection?: any): Promise<void>;
  updateAvailability(id: string, isAvailable: boolean, connection?: any): Promise<void>;
  deactivate(id: string, connection?: any): Promise<void>;
  setApprovalStatus(id: string, status: CourierApprovalStatus, connection?: any): Promise<void>;
  updateLocation(id: string, latitude: number, longitude: number, connection?: any): Promise<void>;
  incrementCancellations(id: string, connection?: any): Promise<void>;
  incrementDeliveries(id: string, connection?: any): Promise<void>;
}
