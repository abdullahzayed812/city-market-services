import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Clock, User, DollarSign, MapPin } from "lucide-react";

const OrdersManagement: React.FC = () => {
  const { t } = useTranslation();
  const [selectedOrderId, setSelectedCategoryId] = useState<string | null>(null);

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
      return response.data.data;
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
                <TableCell>${order.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{order.status}</Badge>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(order.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedCategoryId(order.id)}>
                        <Eye className="h-4 w-4 me-2" />
                        {t("common.edit")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>{t("orders.details")}</DialogTitle>
                        <DialogDescription>{t("orders.info")}</DialogDescription>
                      </DialogHeader>
                      
                      {isLoadingDetails ? (
                        <div className="py-8 text-center">{t("orders.loading_details")}</div>
                      ) : orderDetails ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50 p-3 rounded-lg">
                              <p className="text-sm font-medium text-gray-500">{t("orders.customer_id")}</p>
                              <p className="font-mono text-xs mt-1 truncate">{orderDetails.customerId}</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg">
                              <p className="text-sm font-medium text-gray-500">{t("common.status")}</p>
                              <Badge className="mt-1">{orderDetails.status}</Badge>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg">
                              <p className="text-sm font-medium text-gray-500">{t("orders.total")}</p>
                              <p className="font-bold text-emerald-600 mt-1">${orderDetails.totalAmount.toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg">
                              <p className="text-sm font-medium text-gray-500">{t("orders.created_at")}</p>
                              <p className="text-xs mt-1">{new Date(orderDetails.createdAt).toLocaleString()}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h3 className="font-bold border-b pb-2">{t("orders.vendor_sub_orders")}</h3>
                            {orderDetails.subOrders?.map((sub: any) => (
                              <div key={sub.id} className="border rounded-md p-3 flex justify-between items-center">
                                <div>
                                  <p className="font-medium">{sub.vendorShopName || 'Vendor'}</p>
                                  <p className="text-xs text-gray-500 font-mono">{sub.id}</p>
                                </div>
                                <div className="text-end">
                                  <Badge variant="outline" className="mb-1">{sub.status}</Badge>
                                  <p className="text-sm font-bold text-gray-700">${sub.totalAmount.toFixed(2)}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="bg-slate-50 p-4 rounded-lg flex items-start space-x-3">
                            <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-gray-500 mb-1">{t("orders.delivery_address")}</p>
                              <p className="text-sm text-gray-700">{orderDetails.deliveryAddress || 'Address details not provided'}</p>
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
