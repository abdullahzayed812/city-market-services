import { Delivery } from "../entities/delivery.entity";

// How a delivery fee is split, computed when an office accepts or a freelancer claims.
export interface DeliveryFeeSplit {
  courierPercentage: number | null;
  courierFeeAmount: number;
  officeFeeAmount: number;
  platformFeeAmount: number;
}

export interface IDeliveryRepository {
  create(delivery: Delivery, connection?: any): Promise<Delivery>;
  findById(id: string, connection?: any): Promise<Delivery | null>;
  findByIdForUpdate(id: string, connection: any): Promise<Delivery | null>;
  findByCustomerOrderId(customerOrderId: string, connection?: any): Promise<Delivery[]>;
  findByCustomerOrderAndVendorOrder(customerOrderId: string, vendorOrderId: string, connection?: any): Promise<Delivery | null>;
  findByCourier(courierId: string, limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  findPending(limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  findFreelancePool(limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  findPendingNotYetOpenToFreelance(connection?: any): Promise<Delivery[]>;
  countActiveForCourier(courierId: string, connection?: any): Promise<number>;
  countByStatusForCourier(courierId: string): Promise<Record<string, number>>;
  countByStatusForOffice(officeId: string): Promise<Record<string, number>>;
  sumUnsettledCashForCourier(courierId: string, connection?: any): Promise<number>;
  findByStatus(status: string, connection?: any): Promise<Delivery[]>;
  findAll(limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  findForManager(officeId: string, limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  update(id: string, data: Partial<Delivery>, connection?: any): Promise<void>;
  assignCourier(id: string, courierId: string, connection?: any): Promise<void>;
  countByVendorOrderIds(vendorOrderIds: string[], periodStart?: Date, periodEnd?: Date, connection?: any): Promise<number>;
  acceptDelivery(id: string, officeId: string, fees: DeliveryFeeSplit, connection?: any): Promise<boolean>;
  claimDelivery(id: string, courierId: string, fees: DeliveryFeeSplit, connection?: any): Promise<boolean>;
  returnToPending(id: string, connection?: any): Promise<void>;
  revertToAccepted(id: string, connection?: any): Promise<void>;
  markDeliveriesAsCourierSettled(deliveryIds: string[], settlementId: string, connection?: any): Promise<number>;
  markDeliveriesAsOfficeSettled(deliveryIds: string[], settlementId: string, connection?: any): Promise<number>;
  setDeadline(id: string, field: "acceptanceDeadline" | "assignmentDeadline" | "pickupDeadline", deadline: Date | null, connection?: any): Promise<void>;
  findExpiredPending(connection?: any): Promise<Delivery[]>;
  findExpiredAccepted(connection?: any): Promise<Delivery[]>;
  findExpiredAssigned(connection?: any): Promise<Delivery[]>;
  findPendingWithFutureDeadline(connection?: any): Promise<Delivery[]>;
  findAcceptedWithFutureDeadline(connection?: any): Promise<Delivery[]>;
  findAssignedWithFutureDeadline(connection?: any): Promise<Delivery[]>;
}
