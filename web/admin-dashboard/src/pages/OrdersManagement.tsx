import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import OrderDetailsDialog from "@/features/orders/components/OrderDetailsDialog";

const OrdersManagement: React.FC = () => {
  const { t } = useTranslation();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

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

  const handleViewDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsDetailsDialogOpen(true);
  };

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.orders")}</h2>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orders.order_id")}</TableHead>
              <TableHead>{t("orders.customer")}</TableHead>
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
                <TableCell>{order.customerName || order.customerId}</TableCell>
                <TableCell>${order.totalAmount?.toFixed(2) ?? order.subtotal?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{order.status}</Badge>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(order.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(order.id)}>
                    <Eye className="h-4 w-4 me-2" />
                    {t("common.view")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OrderDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        orderDetails={orderDetails}
        isLoading={isLoadingDetails}
      />
    </div>
  );
};

export default OrdersManagement;
