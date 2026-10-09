import { CustomerOrder } from "../entities/customer-order.entity";

export interface ICustomerOrderRepository {
  create(order: CustomerOrder, connection?: any): Promise<CustomerOrder>;
  findById(id: string, connection?: any): Promise<CustomerOrder | null>;
  findByIdWithLock(id: string, connection: any): Promise<CustomerOrder | null>;
  findByCustomer(customerId: string, limit: number, offset: number, connection?: any): Promise<CustomerOrder[]>;
  findByStatus(status: string, connection?: any): Promise<CustomerOrder[]>;
  findAll(limit: number, offset: number, connection?: any, filter?: CustomerOrderListFilter): Promise<CustomerOrder[]>;
  countFiltered(filter: CustomerOrderListFilter): Promise<number>;
  updateStatus(id: string, status: string, connection?: any): Promise<void>;
  update(id: string, data: Partial<CustomerOrder>, connection?: any): Promise<void>;
  conditionalUpdateStatusToReady(id: string, connection?: any): Promise<number>;
  countAll(connection?: any): Promise<number>;
  countByCustomer(customerId: string, connection?: any): Promise<number>;
  sumCommissionToday(status: string, connection?: any): Promise<number>;
}

// Admin order list filters
export interface CustomerOrderListFilter {
  status?: string;
  // Order id prefix (what the admin sees as #abc123…)
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
}
