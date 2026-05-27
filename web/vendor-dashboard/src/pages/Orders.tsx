import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrders } from "@/hooks/useOrders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MoreHorizontal, CheckCircle, XCircle, ChevronDown, Send, AlertCircle } from "lucide-react";
import { VendorOrderStatus } from "@city-market/shared";
import type { VendorOrderWithItemsDto, ProposeChangesDto } from "@city-market/shared";
import { OrderPreparationModal } from "@/features/orders/components/OrderPreparationModal";
import { SlaCountdownBadge } from "@/components/SlaCountdownBadge";

const Orders = () => {
  const { t } = useTranslation();
  const { orders, isLoading, isError, updateStatus, cancelOrder, proposeChanges } = useOrders();
  const [isPreparationModalOpen, setIsPreparationModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<VendorOrderWithItemsDto | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  if (isError) {
    return <div className="flex items-center justify-center h-full text-destructive">{t("orders.errorLoading")}</div>;
  }

  const handleOpenPreparationModal = (order: VendorOrderWithItemsDto) => {
    setSelectedOrder(order);
    setIsPreparationModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedOrder(null);
    setIsPreparationModalOpen(false);
  };

  const handlePreparationSubmit = (proposals: ProposeChangesDto[]) => {
    if (selectedOrder) {
      proposeChanges({ orderId: selectedOrder.id, proposals });
      handleCloseModals();
    }
  };

  const getStatusColor = (status: VendorOrderStatus) => {
    switch (status) {
      case VendorOrderStatus.DRAFT:
        return "bg-gray-100 text-gray-800";
      case VendorOrderStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case VendorOrderStatus.PREPARING:
        return "bg-amber-100 text-amber-800";
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
    return t(`orders.statuses.${status.toLowerCase()}`, status);
  };

  return (
    <div className="">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("common.orders")}</h1>
          <p className="text-muted-foreground">{t("orders.subtitle")}</p>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]"></TableHead>
              <TableHead>{t("orders.orderId")}</TableHead>
              <TableHead>{t("orders.date")}</TableHead>
              <TableHead>{t("orders.customer")}</TableHead>
              <TableHead>{t("orders.status")}</TableHead>
              <TableHead className="text-end">{t("orders.amount")}</TableHead>
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
                    <TableCell>{order.customerName || t("orders.customer")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Badge className={getStatusColor(order.status)}>{formatStatus(order.status)}</Badge>
                        {order.status === VendorOrderStatus.PENDING && (
                          <SlaCountdownBadge deadline={(order as any).vendorConfirmationDeadline} label={t("orders.confirmBefore", "Confirm")} />
                        )}
                        {order.status === VendorOrderStatus.PROPOSAL_SENT && (
                          <SlaCountdownBadge deadline={(order as any).customerDecisionDeadline} label={t("orders.customerDeciding", "Customer deciding")} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-end">${order.totalAmount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {order.status === VendorOrderStatus.DRAFT && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-orange-600"
                                onClick={() =>
                                  updateStatus({
                                    id: order.id,
                                    status: VendorOrderStatus.PENDING,
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4" /> {t("orders.pendingOrder")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => cancelOrder(order.id)}>
                                <XCircle className="h-4 w-4" /> {t("orders.cancelOrder")}
                              </DropdownMenuItem>
                            </>
                          )}

                          {order.status === VendorOrderStatus.PENDING && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-orange-600"
                                onClick={() =>
                                  updateStatus({
                                    id: order.id,
                                    status: VendorOrderStatus.PREPARING,
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4" /> {t("orders.prepareOrder")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => cancelOrder(order.id)}>
                                <XCircle className="h-4 w-4" /> {t("orders.cancelOrder")}
                              </DropdownMenuItem>
                            </>
                          )}

                          {order.status === VendorOrderStatus.PREPARING && (
                            <>
                              <DropdownMenuItem className="gap-2 text-blue-600" onClick={() => handleOpenPreparationModal(order)}>
                                <Send className="h-4 w-4" /> {t("orders.proposeChanges")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-green-600"
                                onClick={() =>
                                  updateStatus({
                                    id: order.id,
                                    status: VendorOrderStatus.CONFIRMED,
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4" /> {t("orders.confirmOrder")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="p-4 bg-muted/50">
                          {order.cancellationReason && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              <p className="text-sm text-red-700">
                                <span className="font-semibold">{t("orders.cancellationReason")}: </span>
                                {order.cancellationReason}
                              </p>
                            </div>
                          )}
                          <h4 className="font-semibold mb-2">{t("orders.orderItems")}</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("orders.productName")}</TableHead>
                                <TableHead>{t("orders.qtyWeight")}</TableHead>
                                <TableHead>{t("orders.price")}</TableHead>
                                <TableHead className="text-end">{t("orders.total")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.productName}</TableCell>
                                  <TableCell>
                                    {item.quantity ? item.quantity : `≈ ${(item.requestedWeightGrams || 0) / 1000} ${t("inventory.units.kg")}`}
                                    {item.actualWeightGrams &&
                                      ` (${t("orders.actual")}: ${(item.actualWeightGrams / 1000).toFixed(2)} ${t("inventory.units.kg")})`}
                                  </TableCell>
                                  <TableCell>${item.unitPrice}</TableCell>
                                  <TableCell className="text-end">${item.totalPrice}</TableCell>
                                </TableRow>
                              ))}
                              {order.items.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                    {t("orders.noItems")}
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
                  {t("orders.noOrders")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {selectedOrder && (
        <>
          <OrderPreparationModal order={selectedOrder} isOpen={isPreparationModalOpen} onClose={handleCloseModals} onSubmit={handlePreparationSubmit} />
        </>
      )}
    </div>
  );
};

export default Orders;
