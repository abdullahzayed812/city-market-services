import { CustomerOrder } from "../../core/entities/customer-order.entity";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { VendorOrderItem } from "../../core/entities/vendor-order-item.entity";
import { OrderItemProposal } from "../../core/entities/order-item-proposal.entity";
import { OrderWithItems, VendorOrderWithItemsDto } from "../../core/dto/order.dto";

export class OrderMapper {
  static mapCustomerOrder(order: CustomerOrder): CustomerOrder {
    return {
      ...order,
      subtotal: order.subtotal / 1000,
      deliveryFee: order.deliveryFee / 1000,
      totalAmount: order.totalAmount / 1000,
      commissionAmount: order.commissionAmount / 1000,
    };
  }

  static mapVendorOrder(order: VendorOrder): VendorOrder {
    return {
      ...order,
      subtotal: order.subtotal / 1000,
      commissionAmount: order.commissionAmount / 1000,
      totalAmount: order.totalAmount / 1000,
    };
  }

  static mapVendorOrderItem(item: VendorOrderItem): VendorOrderItem {
    return {
      ...item,
      totalPrice: item.totalPrice / 1000,
      requestedWeight: item.requestedWeight || (item.requestedWeightGrams ? item.requestedWeightGrams / 1000 : undefined),
      actualWeight: item.actualWeight || (item.actualWeightGrams ? item.actualWeightGrams / 1000 : undefined),
    };
  }

  static mapProposal(proposal: OrderItemProposal): OrderItemProposal {
    return {
      ...proposal,
      proposedWeight: proposal.proposedWeight || (proposal.proposedWeightGrams ? proposal.proposedWeightGrams / 1000 : undefined),
    };
  }

  static mapOrderWithItems(
    co: CustomerOrder,
    voList: (VendorOrder & { items: VendorOrderItem[]; vendorName?: string; proposals?: OrderItemProposal[] })[]
  ): OrderWithItems {
    return {
      order: this.mapCustomerOrder(co),
      vendorOrders: voList.map((vo) => ({
        ...this.mapVendorOrder(vo),
        vendorName: vo.vendorName,
        items: vo.items.map((i) => this.mapVendorOrderItem(i)),
        proposals: vo.proposals?.map((p) => this.mapProposal(p)),
      })),
    };
  }

  static mapVendorOrderWithItems(vo: VendorOrderWithItemsDto): VendorOrderWithItemsDto {
      return {
          ...this.mapVendorOrder(vo),
          items: vo.items.map(i => this.mapVendorOrderItem(i))
      } as VendorOrderWithItemsDto;
  }
}
