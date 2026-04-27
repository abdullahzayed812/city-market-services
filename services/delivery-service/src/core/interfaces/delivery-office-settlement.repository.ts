import { DeliveryOfficeSettlement } from "../entities/delivery-office-settlement.entity";
import { PoolConnection } from "mysql2/promise";

export interface IDeliveryOfficeSettlementRepository {
  create(settlement: DeliveryOfficeSettlement, connection?: PoolConnection): Promise<DeliveryOfficeSettlement>;
  findById(id: string, connection?: PoolConnection): Promise<DeliveryOfficeSettlement | null>;
  findAll(limit: number, offset: number, connection?: PoolConnection): Promise<DeliveryOfficeSettlement[]>;
  findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: PoolConnection): Promise<DeliveryOfficeSettlement[]>;
  updateStatus(id: string, status: string, settledAt?: Date, connection?: PoolConnection): Promise<void>;
}
