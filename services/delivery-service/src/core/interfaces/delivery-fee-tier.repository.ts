import { DeliveryFeeTier } from "../entities/delivery-fee-tier.entity";

export interface IDeliveryFeeTierRepository {
  findAll(): Promise<DeliveryFeeTier[]>;
  findById(id: string): Promise<DeliveryFeeTier | null>;
  findByAmount(amount: number): Promise<DeliveryFeeTier | null>;
  create(tier: DeliveryFeeTier): Promise<DeliveryFeeTier>;
  update(id: string, data: Partial<DeliveryFeeTier>): Promise<void>;
  delete(id: string): Promise<void>;
}
