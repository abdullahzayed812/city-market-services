import { v4 as uuidv4 } from "uuid";
import { CommissionTier } from "../core/entities/commission-tier.entity";
import { ICommissionTierRepository } from "../core/interfaces/commission-tier.repository";

export class CommissionTierService {
    constructor(private tierRepository: ICommissionTierRepository) { }

    async getAllTiers(): Promise<CommissionTier[]> {
        return this.tierRepository.findAll();
    }

    async getTierById(id: string): Promise<CommissionTier | null> {
        return this.tierRepository.findById(id);
    }

    async createTier(data: Omit<CommissionTier, "id">): Promise<CommissionTier> {
        await this.validateTier(data);

        const tier: CommissionTier = {
            id: uuidv4(),
            ...data,
        };

        await this.tierRepository.create(tier);
        return tier;
    }

    async updateTier(id: string, data: Partial<CommissionTier>): Promise<void> {
        const existing = await this.tierRepository.findById(id);
        if (!existing) {
            throw new Error("Tier not found");
        }

        const updatedData = { ...existing, ...data };
        await this.validateTier(updatedData, id);

        await this.tierRepository.update(id, data);
    }

    async deleteTier(id: string): Promise<void> {
        await this.tierRepository.delete(id);
    }

    async findTierByAmount(amount: number): Promise<CommissionTier | null> {
        return this.tierRepository.findByAmount(amount);
    }

    private async validateTier(tier: Omit<CommissionTier, "id">, excludeId?: string): Promise<void> {
        if (tier.minAmount < 0) {
            throw new Error("Min amount cannot be negative");
        }
        if (tier.maxAmount !== null && tier.maxAmount <= tier.minAmount) {
            throw new Error("Max amount must be greater than min amount");
        }
        if (tier.percentage < 0 || tier.percentage > 100) {
            throw new Error("Percentage must be between 0 and 100");
        }

        const allTiers = await this.tierRepository.findAll();
        for (const existing of allTiers) {
            if (excludeId && existing.id === excludeId) continue;

            // Overlap check
            const overlaps = this.checkOverlap(
                tier.minAmount,
                tier.maxAmount,
                existing.minAmount,
                existing.maxAmount
            );

            if (overlaps) {
                throw new Error(`Tier overlaps with existing tier (${existing.minAmount} - ${existing.maxAmount || "∞"})`);
            }
        }
    }

    private checkOverlap(min1: number, max1: number | null, min2: number, max2: number | null): boolean {
        const effectiveMax1 = max1 === null ? Infinity : max1;
        const effectiveMax2 = max2 === null ? Infinity : max2;

        return min1 < effectiveMax2 && effectiveMax1 > min2;
    }
}
