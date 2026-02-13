import { CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";

export interface OrderStatusHistory {
  id: string;
  customerOrderId?: string;
  vendorOrderId?: string;
  status: CustomerOrderStatus | VendorOrderStatus;
  notes?: string;
  createdAt: Date;
}
