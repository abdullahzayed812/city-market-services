import { useState, useEffect, useMemo } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deliveryService } from "@/services/api/delivery.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Package, Clock, User } from "lucide-react";
import { DeliveryStatus, EventType } from "@city-market/shared";
import type { Delivery, Courier } from "@city-market/shared";
import AssignCourierDialog from "@/features/deliveries/components/AssignCourierDialog";

const Deliveries = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [assigningDeliveryId, setAssigningDeliveryId] = useState<string | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const { data: deliveries = [], isLoading } = useQuery<Delivery[] | undefined>({
    queryKey: ["deliveries"],
    queryFn: deliveryService.getAllDeliveries,
  });

  const { data: availableCouriers = [] } = useQuery<Courier[] | undefined>({
    queryKey: ["available-couriers"],
    queryFn: deliveryService.getAvailableCouriers,
  });

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    };

    const events = [
      EventType.ORDER_READY,
      EventType.DELIVERY_CREATED,
      EventType.COURIER_ASSIGNED,
      EventType.ORDER_PICKED_UP,
      EventType.ORDER_ON_THE_WAY,
      EventType.ORDER_DELIVERED,
    ];

    events.forEach((event) => socket.on(event, handleUpdate));

    return () => {
      events.forEach((event) => socket.off(event, handleUpdate));
    };
  }, [socket, queryClient]);

  const assignMutation = useMutation({
    mutationFn: ({ deliveryId, courierId }: { deliveryId: string; courierId: string }) =>
      deliveryService.assignCourier(deliveryId, { courierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["available-couriers"] });
      setAssigningDeliveryId(null);
      setIsAssignDialogOpen(false);
    },
  });

  const deliveriesWithTotal = useMemo(() => {
    return deliveries.map((d) => ({
      ...d,
      computedTotal:
        d.vendorOrders?.reduce((total: number, vo: any) => {
          return (
            total +
            (vo.items?.reduce((sum: number, item: any) => {
              return sum + (item.totalPrice || 0);
            }, 0) || 0)
          );
        }, 0) || 0,
    }));
  }, [deliveries]);

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case DeliveryStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case DeliveryStatus.ASSIGNED:
        return "bg-blue-100 text-blue-800";
      case DeliveryStatus.PICKED_UP:
        return "bg-purple-100 text-purple-800";
      case DeliveryStatus.ON_THE_WAY:
        return "bg-indigo-100 text-indigo-800";
      case DeliveryStatus.DELIVERED:
        return "bg-green-100 text-green-800";
      case DeliveryStatus.FAILED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatStatus = (status: string) => {
    return t(`orders.${status.toLowerCase()}`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <h1 className="text-3xl font-bold">{t("common.deliveries")}</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {deliveries.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-xl border-dashed">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("common.no_deliveries")}</p>
          </div>
        ) : (
          deliveriesWithTotal.map((delivery: Delivery) => (
            <Card key={delivery.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between bg-muted/30 py-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Order #{delivery.customerOrderId?.substring(0, 8)}</CardTitle>
                </div>
                <Badge className={getStatusColor(delivery.status)}>{formatStatus(delivery.status)}</Badge>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t("orders.pickup_details")}</p>
                        <p className="text-sm text-muted-foreground">{delivery.pickupLocations[0]?.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t("orders.customer_address")}</p>
                        <p className="text-sm text-muted-foreground">{delivery.deliveryAddress}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm">
                        {t("common.created_at")}: {new Date(delivery.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {delivery.courierId && (
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm">
                          {t("common.courier")}: {delivery.courierId} (ID)
                        </p>
                      </div>
                    )}

                    {delivery.status === DeliveryStatus.PENDING && (
                      <Button
                        className="w-full mt-4"
                        onClick={() => {
                          setAssigningDeliveryId(delivery.id);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        {t("common.assign")}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    {t("orders.order_items")}
                  </h4>
                  <div className="space-y-4">
                    {delivery.vendorOrders?.map((vo: any) => (
                      <div key={vo.id} className="bg-muted/20 p-3 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-bold text-primary">{vo.vendorName || "Vendor"}</span>
                        </div>
                        <div className="space-y-1">
                          {vo.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {item.productName} {item.quantity ? `x${item.quantity}` : ""}
                                {item.actualWeightGrams
                                  ? ` (${(item.actualWeightGrams / 1000).toFixed(2)} kg)`
                                  : item.requestedWeightGrams
                                    ? ` (${(item.requestedWeightGrams / 1000).toFixed(2)} kg)`
                                    : ""}
                              </span>
                              <span className="font-medium">
                                {item.totalPrice.toFixed(2)} {t("common.currency")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="mt-4 flex justify-between items-center border-t pt-3">
                      <span className="text-sm font-semibold">{t("orders.total_price")}</span>
                      <span className="text-sm font-bold text-primary">
                        {delivery?.computedTotal?.toFixed(2)} {t("common.currency")}
                      </span>
                    </div>
                    {(!delivery.vendorOrders || delivery.vendorOrders.length === 0) && (
                      <p className="text-sm text-muted-foreground italic">{t("orders.no_items")}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AssignCourierDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        availableCouriers={availableCouriers || []}
        onAssign={(courierId) => {
          if (assigningDeliveryId) {
            assignMutation.mutate({ deliveryId: assigningDeliveryId, courierId });
          }
        }}
        isPending={assignMutation.isPending}
      />
    </div>
  );
};

export default Deliveries;
