import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { orderService } from "@/services/api/order.service";
import { useAuth } from "@/components/AuthProvider";
import { useSocket } from "@/contexts/SocketContext";
import { VendorOrderStatus, type ProposeChangesDto, EventType } from "@city-market/shared"; // Import VendorOrderStatus

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
      EventType.VENDOR_ORDER_CREATED,
      EventType.VENDOR_ORDER_CONFIRMED,
      EventType.VENDOR_ORDER_PROPOSED,
      EventType.VENDOR_ORDER_CANCELLED,
      EventType.PROPOSAL_ACCEPTED,
      EventType.PROPOSAL_REJECTED,
      EventType.ORDER_CONFIRMED,
      EventType.ORDER_CANCELLED,
      EventType.ORDER_READY,
      EventType.ORDER_PICKED_UP,
      EventType.ORDER_ON_THE_WAY,
      EventType.ORDER_DELIVERED,
    ];

    events.forEach((event) => socket.on(event, handleUpdate));

    return () => {
      events.forEach((event) => socket.off(event, handleUpdate));
    };
  }, [socket, vendorId, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, itemWeights }: { id: string; status: VendorOrderStatus; itemWeights?: { itemId: string; actualWeight?: number; actualWeightGrams?: number }[] }) =>
      orderService.updateOrderStatus(id, status, itemWeights),
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

  const proposeChangesMutation = useMutation({
    mutationFn: ({ orderId, proposals }: { orderId: string; proposals: ProposeChangesDto[] }) =>
      orderService.proposeChanges(orderId, proposals),
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
    proposeChanges: proposeChangesMutation.mutate,
    isUpdating: updateStatusMutation.isPending || cancelOrderMutation.isPending || proposeChangesMutation.isPending,
  };
};
