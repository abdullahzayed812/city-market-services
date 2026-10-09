import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Copy } from "lucide-react";
import OrderDetailsDialog from "@/features/orders/components/OrderDetailsDialog";
import { CustomerOrderStatus } from "@city-market/shared";
import { Input } from "@/components/ui/input";
import { ListToolbar, FilterSelect } from "@/components/ListToolbar";
import { Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 20;
import { useToast } from "@/hooks/use-toast";

const OrdersManagement: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  // Server-side filters + paging. Search matches the start of the order id (#xxxxxxxx).
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = {
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  };
  React.useEffect(() => setPage(1), [debouncedSearch, status, from, to]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["adminOrders", params, page],
    queryFn: async () => (await adminApi.getOrders({ ...params, page, limit: PAGE_SIZE })).data.data,
    placeholderData: (previous) => previous,
  });
  const orders = data?.items;
  const total = data?.total ?? 0;

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

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ description: t("orders.order_id_copied", "Order ID copied to clipboard") });
  };

  return (
    <div className="">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.orders")}</h2>

      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder={t("list.search_orders")} total={total}>
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel={t("list.all_statuses")}
          className="w-[220px] bg-white"
          options={Object.values(CustomerOrderStatus).map((s) => ({ value: s, label: s }))}
        />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          {t("list.from")}
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px] bg-white" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          {t("list.to")}
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px] bg-white" />
        </label>
      </ListToolbar>

      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${isFetching ? "opacity-60" : ""}`}>
        {isLoading && <div className="p-8 text-center">{t("common.loading")}</div>}
        {!isLoading && orders?.length === 0 && <div className="p-8 text-center text-slate-500">{t("list.no_results")}</div>}
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
                <TableCell className="font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => handleCopyId(order.id)}
                    title={order.id}
                    className="inline-flex items-center gap-1.5 text-gray-600 hover:text-primary transition-colors"
                  >
                    #{order.id.slice(0, 8)}
                    <Copy className="h-3 w-3 opacity-50" />
                  </button>
                </TableCell>
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
        <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPageChange={setPage} className="py-4" />
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
