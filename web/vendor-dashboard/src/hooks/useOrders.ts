import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { orderService } from "@/services/api/order.service";
import { useAuth } from "@/components/AuthProvider";
import { useSocket } from "@/contexts/SocketContext";

export const useOrders = () => {
  const { vendor } = useAuth();
  const vendorId = vendor?.id;
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["vendor-orders", vendorId],
    queryFn: () => orderService.getVendorOrders(vendorId!),
    enabled: !!vendorId,
  });

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !vendorId) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders", vendorId] });
    };

    const events = [
      "VENDOR_ORDER_CREATED",
      "ORDER_CONFIRMED",
      "ORDER_CANCELLED",
      "ORDER_READY",
      "ORDER_PICKED_UP",
      "ORDER_ON_THE_WAY",
      "ORDER_DELIVERED",
    ];

    events.forEach((event) => socket.on(event, handleUpdate));

    return () => {
      events.forEach((event) => socket.off(event, handleUpdate));
    };
  }, [socket, vendorId, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => orderService.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders", vendorId] });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id: string) => orderService.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders", vendorId] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    isError: ordersQuery.isError,
    updateStatus: updateStatusMutation.mutate,
    cancelOrder: cancelOrderMutation.mutate,
    isUpdating: updateStatusMutation.isPending || cancelOrderMutation.isPending,
  };
};
