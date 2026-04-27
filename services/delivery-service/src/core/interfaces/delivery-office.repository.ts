import { DeliveryOffice } from "../entities/delivery-office.entity";

export interface IDeliveryOfficeRepository {
  findById(id: string, connection?: any): Promise<DeliveryOffice | null>;
  findByUserId(userId: string, connection?: any): Promise<DeliveryOffice | null>;
  findAll(limit: number, offset: number, connection?: any): Promise<DeliveryOffice[]>;
}
