import { Settlement } from "../entities/settlement.entity";

export interface ISettlementRepository {
    create(settlement: Settlement, connection?: any): Promise<Settlement>;
    findById(id: string, connection?: any): Promise<Settlement | null>;
    findByVendor(vendorId: string, limit: number, offset: number, connection?: any): Promise<Settlement[]>;
    updateStatus(id: string, status: string, settledAt?: Date, connection?: any): Promise<void>;
    getPlatformOverview(connection?: any): Promise<{
        totalPendingPayouts: number;
        totalSettledAmount: number;
        platformCommissionEarned: number;
    }>;
}
