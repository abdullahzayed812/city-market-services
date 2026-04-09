export interface CommissionTier {
    id: string;
    minAmount: number;
    maxAmount: number | null;
    percentage: number;
}

export class CommissionCalculator {
    static calculate(amount: number, tiers: CommissionTier[]): { amount: number; percentage: number } {
        const tier = tiers.find(
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
