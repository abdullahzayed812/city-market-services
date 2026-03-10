import { CustomerOrderStatus, VendorOrderStatus } from "../enums";
import { ProposalType, ProposalStatus } from "../enums/proposal-enums";

export interface CustomerOrder {
  id: string;
  customerId: string;
  status: CustomerOrderStatus;
  subtotal: number;
  deliveryFee: number;
  commissionAmount: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  customerNotes?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorOrder {
  id: string;
  customerOrderId: string;
  vendorId: string;
  status: VendorOrderStatus;
  subtotal: number;
  commissionAmount: number;
  totalAmount: number;
  deliveryId?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorOrderItem {
  id: string;
  vendorOrderId: string;
  vendorProductId: string;
  productName: string;
  quantity?: number;
  requestedWeightGrams?: number;
  actualWeightGrams?: number;
  requestedWeight?: number; // Computed for API (KG)
  actualWeight?: number; // Computed for API (KG)
  unitPrice: number;
  totalPrice: number;
}

export interface OrderItemProposal {
  id: string;
  vendorOrderItemId: string;
  type: ProposalType;
  proposedQuantity?: number;
  requestedWeightGrams?: number;
  proposedWeightGrams?: number;
  proposedWeight?: number; // Computed for API (KG)
  requestedWeight?: number; // Computed for API (KG)
  status: ProposalStatus;
  createdAt: Date;
  updatedAt: Date;
  vendorName?: string;
  productName?: string;
}

export interface OrderWithItems {
  order: CustomerOrder;
  vendorOrders: (VendorOrder & { items: VendorOrderItem[]; vendorName?: string; proposals?: OrderItemProposal[] })[];
}

export interface CreateOrderItemDto {
  vendorProductId: string;
  quantity?: number;
  weightGrams?: number;
}

export interface CreateOrderDto {
  customerId?: string;
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
  actualWeightGrams?: number;
}

export interface ProposeChangesDto {
  itemId: string;
  type: ProposalType;
  proposedQuantity?: number;
  requestedWeightGrams?: number;
  proposedWeightGrams?: number;
}

export interface VendorOrderWithItemsDto extends VendorOrder {
  items: VendorOrderItem[];
}
