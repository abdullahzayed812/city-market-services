import { CourierSettlement } from "../entities/courier-settlement.entity";

export interface ICourierSettlementRepository {
  create(settlement: CourierSettlement, connection?: any): Promise<CourierSettlement>;
  findById(id: string, connection?: any): Promise<CourierSettlement | null>;
  findByCourier(courierId: string, limit: number, offset: number, connection?: any): Promise<CourierSettlement[]>;
  findByOfficeId(deliveryOfficeId: string, limit: number, offset: number, connection?: any): Promise<CourierSettlement[]>;
  findAll(limit: number, offset: number, connection?: any): Promise<CourierSettlement[]>;
  updateStatus(id: string, status: string, settledAt?: Date, connection?: any): Promise<void>;
  getPlatformOverview(connection?: any): Promise<{
    totalPendingPayouts: number;
    totalSettledAmount: number;
    totalDeliveryFees: number;
  }>;
}
