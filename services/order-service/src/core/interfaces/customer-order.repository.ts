import { CustomerOrder } from "../entities/customer-order.entity";

export interface ICustomerOrderRepository {
    create(order: CustomerOrder): Promise<CustomerOrder>;
    findById(id: string): Promise<CustomerOrder | null>;
    findByCustomer(customerId: string, limit: number, offset: number): Promise<CustomerOrder[]>;
    findByStatus(status: string): Promise<CustomerOrder[]>;
    findAll(limit: number, offset: number): Promise<CustomerOrder[]>;
    updateStatus(id: string, status: string): Promise<void>;
    update(id: string, data: Partial<CustomerOrder>): Promise<void>;
}
