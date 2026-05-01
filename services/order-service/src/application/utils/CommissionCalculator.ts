import { CommissionTier } from "../../core/entities/commission-tier.entity";

export class CommissionCalculator {
    static calculate(
        amount: number,
        tiers: CommissionTier[],
        vendorId?: string,
        vendorType?: string
    ): { amount: number; percentage: number } {
        // Priority 1: Specific Vendor
        let applicableTiers = vendorId ? tiers.filter(t => t.vendorId === vendorId) : [];

        // Priority 2: Vendor Type
        if (applicableTiers.length === 0 && vendorType) {
            applicableTiers = tiers.filter(t => t.vendorType === vendorType && !t.vendorId);
        }

        // Priority 3: Global Default
        if (applicableTiers.length === 0) {
            applicableTiers = tiers.filter(t => !t.vendorId && !t.vendorType);
        }

        const tier = applicableTiers.find(
            (t) => amount >= t.minAmount && (t.maxAmount === null || amount < t.maxAmount)
        );

        if (!tier) {
            return { amount: 0, percentage: 0 };
        }

        return {
            amount: (amount * tier.percentage) / 100,
            percentage: tier.percentage
        };
    }
}
