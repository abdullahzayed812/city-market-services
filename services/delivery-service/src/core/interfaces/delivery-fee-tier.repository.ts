import { PoolConnection } from "mysql2/promise";
import { DeliveryFeeTier } from "../entities/delivery-fee-tier.entity";

export interface IDeliveryFeeTierRepository {
  findAll(): Promise<DeliveryFeeTier[]>;
  findById(id: string, connection?: PoolConnection): Promise<DeliveryFeeTier | null>;
  findByAmount(amount: number, connection?: PoolConnection): Promise<DeliveryFeeTier | null>;
  create(tier: DeliveryFeeTier): Promise<DeliveryFeeTier>;
  update(id: string, data: Partial<DeliveryFeeTier>): Promise<void>;
  delete(id: string): Promise<void>;
}
