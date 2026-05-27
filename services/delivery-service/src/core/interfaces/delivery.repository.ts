import { Delivery } from "../entities/delivery.entity";

export interface IDeliveryRepository {
  create(delivery: Delivery, connection?: any): Promise<Delivery>;
  findById(id: string, connection?: any): Promise<Delivery | null>;
  findByCustomerOrderId(customerOrderId: string, connection?: any): Promise<Delivery[]>;
  findByCustomerOrderAndVendorOrder(customerOrderId: string, vendorOrderId: string, connection?: any): Promise<Delivery | null>;
  findByCourier(courierId: string, limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  findPending(connection?: any): Promise<Delivery[]>;
  findByStatus(status: string, connection?: any): Promise<Delivery[]>;
  findAll(limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  findForManager(officeId: string, limit: number, offset: number, connection?: any): Promise<Delivery[]>;
  update(id: string, data: Partial<Delivery>, connection?: any): Promise<void>;
  assignCourier(id: string, courierId: string, connection?: any): Promise<void>;
  countByVendorOrderIds(vendorOrderIds: string[], periodStart?: Date, periodEnd?: Date, connection?: any): Promise<number>;
  acceptDelivery(id: string, officeId: string, windowMinutes: number, connection?: any): Promise<boolean>;
  markDeliveriesAsCourierSettled(deliveryIds: string[], settlementId: string, connection?: any): Promise<void>;
  markDeliveriesAsOfficeSettled(deliveryIds: string[], settlementId: string, connection?: any): Promise<void>;
  setDeadline(id: string, field: "acceptanceDeadline" | "assignmentDeadline" | "pickupDeadline", deadline: Date | null, connection?: any): Promise<void>;
  findExpiredPending(connection?: any): Promise<Delivery[]>;
  findExpiredAccepted(connection?: any): Promise<Delivery[]>;
  findExpiredAssigned(connection?: any): Promise<Delivery[]>;
  findPendingWithFutureDeadline(connection?: any): Promise<Delivery[]>;
  findAcceptedWithFutureDeadline(connection?: any): Promise<Delivery[]>;
  findAssignedWithFutureDeadline(connection?: any): Promise<Delivery[]>;
}
