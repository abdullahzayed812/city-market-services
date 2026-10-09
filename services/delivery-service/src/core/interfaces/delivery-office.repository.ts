import { DeliveryOffice, OfficeApprovalStatus } from "../entities/delivery-office.entity";

export interface IDeliveryOfficeRepository {
  findById(id: string, connection?: any): Promise<DeliveryOffice | null>;
  findByUserId(userId: string, connection?: any): Promise<DeliveryOffice | null>;
  findAll(limit: number, offset: number, connection?: any): Promise<DeliveryOffice[]>;
  countActive(connection?: any): Promise<number>;
  create(office: DeliveryOffice, connection?: any): Promise<DeliveryOffice>;
  setApprovalStatus(id: string, status: OfficeApprovalStatus, connection?: any): Promise<void>;
  findAllByApproval(limit: number, offset: number, approvalStatus?: OfficeApprovalStatus): Promise<DeliveryOffice[]>;
}
