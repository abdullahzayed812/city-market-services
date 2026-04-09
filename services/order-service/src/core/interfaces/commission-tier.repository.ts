import { CommissionTier } from "../entities/commission-tier.entity";

export interface ICommissionTierRepository {
    findAll(): Promise<CommissionTier[]>;
    findById(id: string): Promise<CommissionTier | null>;
    create(tier: CommissionTier): Promise<void>;
    update(id: string, tier: Partial<CommissionTier>): Promise<void>;
    delete(id: string): Promise<void>;
    findByAmount(amount: number): Promise<CommissionTier | null>;
}
