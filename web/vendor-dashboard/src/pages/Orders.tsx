import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrders } from "@/hooks/useOrders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MoreHorizontal, Eye, CheckCircle, XCircle, Package, ChefHat, ChevronDown, Send } from "lucide-react";
import { VendorOrderStatus } from "@city-market/shared";
import type { VendorOrderWithItemsDto, ProposeChangesDto } from "@city-market/shared";
import { ProposalDialog } from "@/components/ProposalDialog";

const Orders = () => {
  const { t } = useTranslation();
  const { orders, isLoading, isError, updateStatus, cancelOrder, proposeChanges } = useOrders();
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<VendorOrderWithItemsDto | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Error loading orders. Please try again later.
      </div>
    );
  }

  const handleOpenProposalDialog = (order: VendorOrderWithItemsDto) => {
    setSelectedOrder(order);
    setIsProposalDialogOpen(true);
  };

  const handleCloseProposalDialog = () => {
    setSelectedOrder(null);
    setIsProposalDialogOpen(false);
  };

  const handleProposeChanges = (proposals: ProposeChangesDto[]) => {
    if (selectedOrder) {
      proposeChanges({ orderId: selectedOrder.id, proposals });
      handleCloseProposalDialog();
    }
  };

  const getStatusColor = (status: VendorOrderStatus) => {
    switch (status) {
      case VendorOrderStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case VendorOrderStatus.PROPOSAL_SENT:
        return "bg-blue-100 text-blue-800";
      case VendorOrderStatus.CONFIRMED:
        return "bg-purple-100 text-purple-800";
      case VendorOrderStatus.PICKED_UP:
        return "bg-indigo-100 text-indigo-800";
      case VendorOrderStatus.ON_THE_WAY:
        return "bg-orange-100 text-orange-800";
      case VendorOrderStatus.DELIVERED:
        return "bg-green-100 text-green-800";
      case VendorOrderStatus.CANCELLED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("common.orders")}</h1>
          <p className="text-muted-foreground">Manage and track your customer orders.</p>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]"></TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order: VendorOrderWithItemsDto) => (
              <Collapsible asChild key={order.id}>
                <Fragment key={order.id}>
                  <TableRow>
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="font-medium">#{order.id.slice(0, 8)}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>{formatStatus(order.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">${order.totalAmount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* <DropdownMenuItem className="gap-2">
                            <Eye className="h-4 w-4" /> View Details
                          </DropdownMenuItem> */}

                          {order.status === VendorOrderStatus.PENDING && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-green-600"
                                onClick={() =>
                                  updateStatus({
                                    id: order.id,
                                    status: VendorOrderStatus.CONFIRMED,
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4" /> Confirm Order
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-blue-600"
                                onClick={() => handleOpenProposalDialog(order)}
                              >
                                <Send className="h-4 w-4" /> Send Proposal
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive"
                                onClick={() => cancelOrder(order.id)}
                              >
                                <XCircle className="h-4 w-4" /> Cancel Order
                              </DropdownMenuItem>
                            </>
                          )}

                          {/* {order.status === VendorOrderStatus.CONFIRMED && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-blue-600"
                                onClick={() =>
                                  updateStatus({
                                    id: order.id,
                                    status: VendorOrderStatus.PICKED_UP,
                                  })
                                }
                              >
                                <ChefHat className="h-4 w-4" /> Mark as Picked Up
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive"
                                onClick={() => cancelOrder(order.id)}
                              >
                                <XCircle className="h-4 w-4" /> Cancel Order
                              </DropdownMenuItem>
                            </>
                          )} */}

                          {/* {order.status === VendorOrderStatus.PICKED_UP && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-green-600"
                                onClick={() =>
                                  updateStatus({
                                    id: order.id,
                                    status: VendorOrderStatus.ON_THE_WAY,
                                  })
                                }
                              >
                                <Package className="h-4 w-4" /> Mark as On The Way
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive"
                                onClick={() => cancelOrder(order.id)}
                              >
                                <XCircle className="h-4 w-4" /> Cancel Order
                              </DropdownMenuItem>
                            </>
                          )} */}

                          {/* {order.status === VendorOrderStatus.ON_THE_WAY && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-green-600"
                                onClick={() =>
                                  updateStatus({
                                    id: order.id,
                                    status: VendorOrderStatus.DELIVERED,
                                  })
                                }
                              >
                                <Package className="h-4 w-4" /> Mark as Delivered
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive"
                                onClick={() => cancelOrder(order.id)}
                              >
                                <XCircle className="h-4 w-4" /> Cancel Order
                              </DropdownMenuItem>
                            </>
                          )} */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="p-4 bg-muted/50">
                          <h4 className="font-semibold mb-2">Order Items</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.productName}</TableCell>
                                  <TableCell>{item.quantity}</TableCell>
                                  <TableCell>${item.unitPrice}</TableCell>
                                  <TableCell className="text-right">${item.totalPrice}</TableCell>
                                </TableRow>
                              ))}
                              {order.items.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                    No items in this order.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </Fragment>
              </Collapsible>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {selectedOrder && (
        <ProposalDialog
          order={selectedOrder}
          isOpen={isProposalDialogOpen}
          onClose={handleCloseProposalDialog}
          onSubmit={handleProposeChanges}
        />
      )}
    </div>
  );
};

export default Orders;
