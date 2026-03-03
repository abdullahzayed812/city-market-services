import { CustomerOrderStatus, VendorOrderStatus } from "@city-market/shared";
import { VendorOrderItem } from "../entities/vendor-order-item.entity";
import { CustomerOrder } from "../entities/customer-order.entity";
import { VendorOrder } from "../entities/vendor-order.entity";
import { OrderItemProposal } from "../entities/order-item-proposal.entity";

export interface CreateOrderItemDto {
  productId: string;
  quantity: number;
}

export interface CreateOrderDto {
  customerId: string;
  items: CreateOrderItemDto[];
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  customerNotes?: string;
}

export interface UpdateCustomerOrderStatusDto {
  status: CustomerOrderStatus;
  notes?: string;
}

export interface UpdateVendorOrderStatusDto {
  status: VendorOrderStatus;
  notes?: string;
}

export interface ProposeChangesDto {
  itemId: string;
  type: "QUANTITY_REDUCTION" | "UNAVAILABLE";
  proposedQuantity?: number;
}

export interface OrderWithItems {
  order: CustomerOrder;
  vendorOrders: (VendorOrder & { items: VendorOrderItem[] })[];
}

export interface VendorOrderWithItemsDto extends VendorOrder {
  items: VendorOrderItem[];
}

