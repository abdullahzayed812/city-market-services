export interface OrderStatusHistory {
  id: string;
  customerOrderId?: string;
  vendorOrderId?: string;
  status: string;
  notes?: string;
  createdAt: Date;
}
