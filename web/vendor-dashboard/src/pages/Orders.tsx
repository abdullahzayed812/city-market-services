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
import { MoreHorizontal, Eye, CheckCircle, XCircle, Package, ChefHat } from "lucide-react";
import { VendorOrderStatus } from "@city-market/shared";
import type { VendorOrder } from "@city-market/shared";

const Orders = () => {
  const { t } = useTranslation();
  const { orders, isLoading, updateStatus, cancelOrder } = useOrders();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const getStatusColor = (status: VendorOrderStatus) => { // Use VendorOrderStatus
    switch (status) {
      case VendorOrderStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case VendorOrderStatus.PROPOSAL_SENT: // New status
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
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order: VendorOrder) => ( // Use VendorOrder
              <TableRow key={order.id}>
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
                      <DropdownMenuItem className="gap-2">
                        <Eye className="h-4 w-4" /> View Details
                      </DropdownMenuItem>

                      {/* Status Transitions */}
                      {order.status === VendorOrderStatus.PENDING && (
                        <>
                          <DropdownMenuItem
                            className="gap-2 text-green-600"
                            onClick={() => updateStatus({ id: order.id, status: VendorOrderStatus.CONFIRMED })}
                          >
                            <CheckCircle className="h-4 w-4" /> Confirm Order
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => cancelOrder(order.id)}>
                            <XCircle className="h-4 w-4" /> Cancel Order
                          </DropdownMenuItem>
                        </>
                      )}

                      {order.status === VendorOrderStatus.CONFIRMED && (
                        <>
                          <DropdownMenuItem
                            className="gap-2 text-blue-600"
                            onClick={() => updateStatus({ id: order.id, status: VendorOrderStatus.PICKED_UP })} // Changed from PREPARING to PICKED_UP
                          >
                            <ChefHat className="h-4 w-4" /> Mark as Picked Up
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => cancelOrder(order.id)}>
                            <XCircle className="h-4 w-4" /> Cancel Order
                          </DropdownMenuItem>
                        </>
                      )}

                      {order.status === VendorOrderStatus.PICKED_UP && ( // Changed from PREPARING
                        <>
                          <DropdownMenuItem
                            className="gap-2 text-green-600"
                            onClick={() => updateStatus({ id: order.id, status: VendorOrderStatus.ON_THE_WAY })} // Changed from READY to ON_THE_WAY
                          >
                            <Package className="h-4 w-4" /> Mark as On The Way
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => cancelOrder(order.id)}>
                            <XCircle className="h-4 w-4" /> Cancel Order
                          </DropdownMenuItem>
                        </>
                      )}

                      {order.status === VendorOrderStatus.ON_THE_WAY && ( // Changed from PREPARING
                        <>
                          <DropdownMenuItem
                            className="gap-2 text-green-600"
                            onClick={() => updateStatus({ id: order.id, status: VendorOrderStatus.DELIVERED })} // Changed from READY to ON_THE_WAY
                          >
                            <Package className="h-4 w-4" /> Mark as Delivered
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => cancelOrder(order.id)}>
                            <XCircle className="h-4 w-4" /> Cancel Order
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Orders;
