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
  update(id: string, data: Partial<Delivery>, connection?: any): Promise<void>;
  assignCourier(id: string, courierId: string, connection?: any): Promise<void>;
  countByVendorOrderIds(vendorOrderIds: string[], periodStart?: Date, periodEnd?: Date, connection?: any): Promise<number>;
}
