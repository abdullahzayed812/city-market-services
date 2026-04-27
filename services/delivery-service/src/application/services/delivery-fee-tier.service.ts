import { randomUUID } from "crypto";
import { DeliveryFeeTier } from "../../core/entities/delivery-fee-tier.entity";
import { IDeliveryFeeTierRepository } from "../../core/interfaces/delivery-fee-tier.repository";
import { ValidationError, NotFoundError } from "@city-market/shared";

export class DeliveryFeeTierService {
  constructor(private tierRepo: IDeliveryFeeTierRepository) {}

  async getAll(): Promise<DeliveryFeeTier[]> {
    return this.tierRepo.findAll();
  }

  async create(data: { minAmount: number; maxAmount: number | null; courierPercentage: number }): Promise<DeliveryFeeTier> {
    await this.validate(data);
    const tier: DeliveryFeeTier = {
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.tierRepo.create(tier);
  }

  async update(id: string, data: Partial<{ minAmount: number; maxAmount: number | null; courierPercentage: number }>): Promise<void> {
    const existing = await this.tierRepo.findById(id);
    if (!existing) throw new NotFoundError("delivery_fee_tier_not_found");
    const merged = { ...existing, ...data };
    await this.validate(merged, id);
    await this.tierRepo.update(id, data);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.tierRepo.findById(id);
    if (!existing) throw new NotFoundError("delivery_fee_tier_not_found");
    await this.tierRepo.delete(id);
  }

  private async validate(
    tier: { minAmount: number; maxAmount: number | null; courierPercentage: number },
    excludeId?: string,
  ): Promise<void> {
    if (tier.minAmount < 0) throw new ValidationError("min_amount_cannot_be_negative");
    if (tier.maxAmount !== null && tier.maxAmount <= tier.minAmount)
      throw new ValidationError("max_amount_must_be_greater_than_min");
    if (tier.courierPercentage < 0 || tier.courierPercentage > 100)
      throw new ValidationError("courier_percentage_must_be_0_to_100");

    const all = await this.tierRepo.findAll();
    for (const existing of all) {
      if (excludeId && existing.id === excludeId) continue;
      if (this.overlaps(tier.minAmount, tier.maxAmount, existing.minAmount, existing.maxAmount))
        throw new ValidationError(`tier_overlaps_with_existing (${existing.minAmount} - ${existing.maxAmount ?? "∞"})`);
    }
  }

  private overlaps(min1: number, max1: number | null, min2: number, max2: number | null): boolean {
    const eMax1 = max1 === null ? Infinity : max1;
    const eMax2 = max2 === null ? Infinity : max2;
    return min1 < eMax2 && eMax1 > min2;
  }
}
