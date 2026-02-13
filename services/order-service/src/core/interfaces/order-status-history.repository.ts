import { OrderStatusHistory } from "../entities/order-status-history.entity";

export interface IOrderStatusHistoryRepository {
  create(history: OrderStatusHistory, connection?: any): Promise<OrderStatusHistory>;
  findByCustomerOrder(customerOrderId: string, connection?: any): Promise<OrderStatusHistory[]>;
  findByVendorOrder(vendorOrderId: string, connection?: any): Promise<OrderStatusHistory[]>;
}
