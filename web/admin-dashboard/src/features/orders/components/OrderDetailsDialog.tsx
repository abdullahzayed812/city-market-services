import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Scale } from "lucide-react";

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderDetails: any;
  isLoading: boolean;
}

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  open,
  onOpenChange,
  orderDetails,
  isLoading,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("orders.details")}</DialogTitle>
          <DialogDescription>{t("orders.info")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">{t("orders.loading_details")}</div>
        ) : orderDetails ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* ── Order Summary ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-500">{t("orders.customer_id")}</p>
                <p className="font-mono text-xs mt-1 truncate">{orderDetails.order.customerId}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-500">{t("common.status")}</p>
                <Badge className="mt-1">{orderDetails.order.status}</Badge>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-500">{t("orders.subtotal")}</p>
                <p className="font-bold text-emerald-600 mt-1">
                  ${orderDetails.order.subtotal?.toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-500">{t("orders.delivery_fee")}</p>
                <p className="font-bold text-blue-600 mt-1">
                  ${orderDetails.order.deliveryFee?.toFixed(2)}
                </p>
              </div>
            </div>

            {/* ── Vendor Sub-Orders ── */}
            <div className="space-y-4">
              <h3 className="font-bold border-b pb-2">{t("orders.vendor_sub_orders")}</h3>
              {orderDetails.vendorOrders?.map((vendorOrder: any) => (
                <div key={vendorOrder.id} className="border rounded-md p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-lg">{vendorOrder.vendorName || "Vendor"}</p>
                      <Badge variant="outline" className="mt-1">
                        {vendorOrder.status}
                      </Badge>
                    </div>
                    <div className="text-end">
                      <p className="text-sm text-gray-500">{t("orders.subtotal")}</p>
                      <p className="font-bold text-gray-800">
                        ${vendorOrder.subtotal?.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Vendor Order Items */}
                  <div className="mt-2 border-t pt-2 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8">{t("common.product")}</TableHead>
                          <TableHead className="h-8 text-center">{t("common.quantity")}</TableHead>
                          <TableHead className="h-8 text-center">{t("orders.weight")}</TableHead>
                          <TableHead className="h-8 text-end">{t("common.total")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorOrder.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="py-2">
                              <p className="font-medium">{item.productName}</p>
                              {vendorOrder.proposals?.find((p: any) => p.vendorOrderItemId === item.id) && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                                    {t("orders.pending_proposal")}
                                  </Badge>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-center">
                              {item.quantity ? `x${item.quantity}` : "-"}
                            </TableCell>
                            <TableCell className="py-2 text-center">
                              {item.requestedWeightGrams ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-gray-500">Req: ≈{(item.requestedWeightGrams / 1000).toFixed(2)}kg</span>
                                  {item.actualWeightGrams && (
                                    <span className="text-xs font-bold text-primary">Act: {(item.actualWeightGrams / 1000).toFixed(2)}kg</span>
                                  )}
                                  {vendorOrder.proposals?.find((p: any) => p.vendorOrderItemId === item.id)?.proposedWeightGrams && (
                                    <span className="text-xs font-bold text-orange-500 flex items-center gap-1">
                                      <Scale className="h-3 w-3" />
                                      Prop: {(vendorOrder.proposals.find((p: any) => p.vendorOrderItemId === item.id).proposedWeightGrams / 1000).toFixed(2)}kg
                                    </span>
                                  )}
                                </div>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="py-2 text-end font-medium">
                              ${item.totalPrice.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Delivery Address ── */}
            <div className="bg-slate-50 p-4 rounded-lg flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{t("orders.delivery_address")}</p>
                <p className="text-sm text-gray-700">
                  {orderDetails.order.deliveryAddress || t("orders.address_not_provided")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-destructive">{t("orders.failed_load")}</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
