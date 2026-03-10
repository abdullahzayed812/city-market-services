import { CustomerOrder } from "../../core/entities/customer-order.entity";
import { VendorOrder } from "../../core/entities/vendor-order.entity";
import { VendorOrderItem } from "../../core/entities/vendor-order-item.entity";
import { OrderItemProposal } from "../../core/entities/order-item-proposal.entity";
import { OrderWithItems, VendorOrderWithItemsDto } from "../../core/dto/order.dto";

export class OrderMapper {
  static mapCustomerOrder(order: CustomerOrder): CustomerOrder {
    return {
      ...order,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      totalAmount: order.totalAmount,
      commissionAmount: order.commissionAmount,
    };
  }

  static mapVendorOrder(order: VendorOrder): VendorOrder {
    return {
      ...order,
      subtotal: order.subtotal,
      commissionAmount: order.commissionAmount,
      totalAmount: order.totalAmount,
    };
  }

  static mapVendorOrderItem(item: VendorOrderItem): VendorOrderItem {
    return {
      ...item,
      totalPrice: item.totalPrice,
      requestedWeight: item.requestedWeightGrams ? item.requestedWeightGrams / 1000 : undefined,
      actualWeight: item.actualWeightGrams ? item.actualWeightGrams / 1000 : undefined,
    };
  }

  static mapProposal(proposal: OrderItemProposal): OrderItemProposal {
    return {
      ...proposal,
      requestedWeight: proposal.requestedWeightGrams ? proposal.requestedWeightGrams / 1000 : undefined,
      proposedWeight: proposal.proposedWeightGrams ? proposal.proposedWeightGrams / 1000 : undefined,
      vendorName: proposal.vendorName,
      productName: proposal.productName,
    };
  }

  static mapOrderWithItems(
    co: CustomerOrder,
    voList: (VendorOrder & { items: VendorOrderItem[]; vendorName?: string; proposals?: OrderItemProposal[] })[],
  ): OrderWithItems {
    return {
      order: this.mapCustomerOrder(co),
      vendorOrders: voList.map((vo) => ({
        ...this.mapVendorOrder(vo),
        vendorName: vo.vendorName,
        items: vo.items.map((i) => this.mapVendorOrderItem(i)),
        // proposals: vo.proposals?.map((p) => this.mapProposal(p)),
      })),
    };
  }

  static mapVendorOrderWithItems(vo: VendorOrderWithItemsDto): VendorOrderWithItemsDto {
    return {
      ...this.mapVendorOrder(vo),
      items: vo.items.map((i) => this.mapVendorOrderItem(i)),
    } as VendorOrderWithItemsDto;
  }
}
