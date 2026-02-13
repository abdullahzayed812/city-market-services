import { CustomerOrder } from "../entities/customer-order.entity";

export interface ICustomerOrderRepository {
    create(order: CustomerOrder, connection?: any): Promise<CustomerOrder>;
    findById(id: string, connection?: any): Promise<CustomerOrder | null>;
    findByCustomer(customerId: string, limit: number, offset: number, connection?: any): Promise<CustomerOrder[]>;
    findByStatus(status: string, connection?: any): Promise<CustomerOrder[]>;
    findAll(limit: number, offset: number, connection?: any): Promise<CustomerOrder[]>;
    updateStatus(id: string, status: string, connection?: any): Promise<void>;
    update(id: string, data: Partial<CustomerOrder>, connection?: any): Promise<void>;
    conditionalUpdateStatusToReady(id: string, connection?: any): Promise<number>;
}
