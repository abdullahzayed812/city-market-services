import React, { useState, useEffect } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Eye, CheckCircle, XCircle } from "lucide-react";
import {
  type CustomerOrder,
  CustomerOrderStatus,
  type OrderWithItems,
  VendorOrderStatus,
  EventType,
} from "@city-market/shared"; // Import shared types

// Removed local Order and VendorOrder interfaces
// Removed local OrderStatus enum

const OrdersManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (selectedOrderId) {
        queryClient.invalidateQueries({ queryKey: ["order-details", selectedOrderId] });
      }
    };
    const events = [
      EventType.ORDER_CREATED,
      EventType.ORDER_CONFIRMED,
      EventType.ORDER_CANCELLED,
      EventType.ORDER_READY,
      EventType.ORDER_PICKED_UP,
      EventType.ORDER_ON_THE_WAY,
      EventType.ORDER_DELIVERED,
      EventType.VENDOR_ORDER_CREATED,
      EventType.VENDOR_ORDER_CONFIRMED,
      EventType.VENDOR_ORDER_PROPOSED,
      EventType.VENDOR_ORDER_CANCELLED,
      EventType.PROPOSAL_ACCEPTED,
      EventType.PROPOSAL_REJECTED,
      EventType.DELIVERY_CREATED,
      EventType.COURIER_ASSIGNED,
    ];
    events.forEach((event) => socket.on(event, handleOrderUpdate));
    return () => events.forEach((event) => socket.off(event, handleOrderUpdate));
  }, [socket, queryClient, selectedOrderId]);

  const { data: orders, isLoading } = useQuery<CustomerOrder[]>({
    // Use CustomerOrder[]
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await adminApi.getOrders();
      return response?.data?.data || [];
    },
  });

  const { data: orderDetails, isLoading: isLoadingDetails } = useQuery<OrderWithItems | null>({
    // Use OrderWithItems
    queryKey: ["order-details", selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const response = await adminApi.getOrderById(selectedOrderId);
      return response?.data?.data || null;
    },
    enabled: !!selectedOrderId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (
      { id, status }: { id: string; status: CustomerOrderStatus } // Use CustomerOrderStatus
    ) => adminApi.updateOrderStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const handleViewDetails = (id: string) => {
    setSelectedOrderId(id);
    setIsModalOpen(true);
  };

  const getStatusColor = (status: CustomerOrderStatus | VendorOrderStatus) => {
    // Accept CustomerOrderStatus or VendorOrderStatus
    if (!status) return "bg-gray-100 text-gray-800";
    switch (status) {
      case CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION:
        return "bg-yellow-100 text-yellow-800"; // New status
      case CustomerOrderStatus.WAITING_CUSTOMER_DECISION:
        return "bg-blue-100 text-blue-800"; // New status
      case CustomerOrderStatus.READY:
        return "bg-cyan-100 text-cyan-800";
      case CustomerOrderStatus.IN_DELIVERY:
        return "bg-indigo-100 text-indigo-800"; // New status
      case CustomerOrderStatus.COMPLETED:
        return "bg-green-100 text-green-800"; // New status
      case CustomerOrderStatus.CANCELLED:
        return "bg-red-100 text-red-800";

      case VendorOrderStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case VendorOrderStatus.PROPOSAL_SENT:
        return "bg-blue-100 text-blue-800";
      case VendorOrderStatus.CONFIRMED:
        return "bg-purple-110 text-purple-800"; // Changed color
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
    if (!status) return "Unknown";
    return status
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  if (isLoading) return <div className="p-8 text-center">Loading orders...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.orders")}</h2>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer ID</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map(
              (
                order: CustomerOrder // Use CustomerOrder
              ) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id.substring(0, 8)}</TableCell>
                  <TableCell>{order.customerId.substring(0, 8)}</TableCell>
                  <TableCell>${order.totalAmount?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>{formatStatus(order.status)}</Badge>
                  </TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(order.id)}>
                          <Eye className="me-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateStatusMutation.mutate({ id: order.id, status: CustomerOrderStatus.READY })
                          } // Use CustomerOrderStatus
                        >
                          <CheckCircle className="me-2 h-4 w-4" />
                          Mark as Ready
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            updateStatusMutation.mutate({ id: order.id, status: CustomerOrderStatus.CANCELLED })
                          } // Use CustomerOrderStatus
                        >
                          <XCircle className="me-2 h-4 w-4" />
                          Cancel Order
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Detailed information for multi-vendor order</DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="py-8 text-center">Loading details...</div>
          ) : orderDetails ? (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-500">Customer ID</p>
                  <div className="text-sm font-mono">{orderDetails.order.customerId}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <Badge className={getStatusColor(orderDetails.order.status)}>
                    {formatStatus(orderDetails.order.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Amount</p>
                  <div className="font-bold text-lg">${orderDetails.order.totalAmount?.toFixed(2)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Created At</p>
                  <div>{new Date(orderDetails.order.createdAt).toLocaleString()}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold border-b pb-2">Vendor Sub-Orders</h3>
                {orderDetails.vendorOrders.map((vo) => (
                  <div key={vo.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-primary">{vo.vendorName}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{vo.id.substring(0, 8)}</span>
                      </div>
                      <Badge className={getStatusColor(vo.status)}>{formatStatus(vo.status)}</Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      {vo.items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>
                            {item.productName} x {item.quantity}
                          </span>
                          <span>${item.totalPrice?.toFixed(2)}</span>
                        </div>
                      )
                      )}
                    </div>
                    <div className="flex justify-between pt-2 border-t font-semibold">
                      <span>Sub-order Total</span>
                      <span>${vo.totalAmount?.toFixed(2)}</span>
                    </div>
                  </div>
                )
                )}
              </div>

              <div className="bg-muted/20 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-1">Delivery Address</p>
                <div className="text-sm">{orderDetails.order.deliveryAddress}</div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-destructive">Failed to load order details.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersManagement;
