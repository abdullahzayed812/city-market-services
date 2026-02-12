import { OrderStatusHistory } from "../entities/order-status-history.entity";

export interface IOrderStatusHistoryRepository {
  create(history: OrderStatusHistory): Promise<OrderStatusHistory>;
  findByCustomerOrder(customerOrderId: string): Promise<OrderStatusHistory[]>;
  findByVendorOrder(vendorOrderId: string): Promise<OrderStatusHistory[]>;
}
