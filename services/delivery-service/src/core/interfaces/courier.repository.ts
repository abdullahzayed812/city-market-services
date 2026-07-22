import { Courier } from "../entities/courier.entity";

export interface ICourierRepository {
  create(courier: Courier, connection?: any): Promise<Courier>;
  findById(id: string, connection?: any): Promise<Courier | null>;
  findByUserId(userId: string, connection?: any): Promise<Courier | null>;
  findAvailable(connection?: any): Promise<Courier[]>;
  findAvailableByOfficeId(deliveryOfficeId: string, connection?: any): Promise<Courier[]>;
  findAll(limit: number, offset: number, connection?: any): Promise<Courier[]>;
  countAll(connection?: any): Promise<number>;
  findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: any): Promise<Courier[]>;
  update(id: string, data: Partial<Courier>, connection?: any): Promise<void>;
  updateAvailability(id: string, isAvailable: boolean, connection?: any): Promise<void>;
  incrementDeliveries(id: string, connection?: any): Promise<void>;
}
