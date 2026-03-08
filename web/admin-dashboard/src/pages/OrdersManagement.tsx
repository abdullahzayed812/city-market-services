import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, MapPin, Scale } from "lucide-react";

const OrdersManagement: React.FC = () => {
  const { t } = useTranslation();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["adminOrders"],
    queryFn: async () => {
      const response = await adminApi.getOrders();
      return response.data.data;
    },
  });

  const { data: orderDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["adminOrder", selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const response = await adminApi.getOrderById(selectedOrderId);
      if (!response.data.data) return null;
      const { order, vendorOrders } = response.data.data;
      return { order, vendorOrders };
    },
    enabled: !!selectedOrderId,
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.orders")}</h2>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orders.order_id")}</TableHead>
              <TableHead>{t("orders.customer_id")}</TableHead>
              <TableHead>{t("orders.total")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("orders.created_at")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id}</TableCell>
                <TableCell className="font-mono text-xs">{order.customerId}</TableCell>
                <TableCell>${order.totalAmount?.toFixed(2) ?? order.subtotal?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{order.status}</Badge>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(order.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(order.id)}>
                        <Eye className="h-4 w-4 me-2" />
                        {t("common.view")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>{t("orders.details")}</DialogTitle>
                        <DialogDescription>{t("orders.info")}</DialogDescription>
                      </DialogHeader>

                      {isLoadingDetails ? (
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
                                {orderDetails.order.deliveryAddress || "Address details not provided"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-destructive">{t("orders.failed_load")}</div>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrdersManagement;
