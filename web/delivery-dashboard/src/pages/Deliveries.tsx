import { useState, useEffect } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deliveryService } from "@/services/api/delivery.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Package, Clock, User } from "lucide-react";
import { DeliveryStatus, EventType } from "@city-market/shared";
import type { Delivery, Courier } from "@city-market/shared"; // Import shared types

const Deliveries = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedCourier, setSelectedCourier] = useState<string>("");
  const [assigningDeliveryId, setAssigningDeliveryId] = useState<string | null>(null);

  const { data: deliveries = [], isLoading } = useQuery<Delivery[] | undefined>({ // Use Delivery[]
    queryKey: ["deliveries"],
    queryFn: deliveryService.getAllDeliveries,
  });

  const { data: availableCouriers = [] } = useQuery<Courier[] | undefined>({ // Use Courier[]
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

    events.forEach(event => socket.on(event, handleUpdate));

    return () => {
      events.forEach(event => socket.off(event, handleUpdate));
    };
  }, [socket, queryClient]);

  const assignMutation = useMutation({
    mutationFn: ({ deliveryId, courierId }: { deliveryId: string; courierId: string }) =>
      deliveryService.assignCourier(deliveryId, { courierId }), // Pass as DTO
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["available-couriers"] });
      setAssigningDeliveryId(null);
      setSelectedCourier("");
    },
  });

  // const updateStatusMutation = useMutation({
  //   mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) => // Use DeliveryStatus and UpdateDeliveryStatusDto
  //     deliveryService.updateDeliveryStatus(id, { status, vendorOrderId: "TODO" }), // TODO: vendorOrderId needs to be passed
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["deliveries"] });
  //   },
  // });

  const handleAssign = () => {
    if (assigningDeliveryId && selectedCourier) {
      assignMutation.mutate({ deliveryId: assigningDeliveryId, courierId: selectedCourier });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const getStatusColor = (status: DeliveryStatus) => { // Use DeliveryStatus
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
    return status
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("common.deliveries")}</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {deliveries.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-xl border-dashed">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No deliveries found.</p>
          </div>
        ) : (
          deliveries.map((delivery: Delivery) => ( // Use Delivery
            <Card key={delivery.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between bg-muted/30 py-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Order #{delivery.customerOrderId?.substring(0, 8)}</CardTitle>
                </div>
                <Badge className={getStatusColor(delivery.status)}>
                  {formatStatus(delivery.status)}
                </Badge>
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
                        {/* Assuming first pickup location is the main one for display */}
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
                    {/* <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm">{delivery.customerPhone}</p> // customerPhone is not directly in Delivery
                    </div> */}
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm">Created at: {new Date(delivery.createdAt).toLocaleString()}</p>
                    </div>
                    {delivery.courierId && (
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm">Courier: {delivery.courierId} (ID)</p> {/* Displaying ID for now */}
                      </div>
                    )}

                    {delivery.status === DeliveryStatus.PENDING && ( // Use DeliveryStatus
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="w-full mt-4" onClick={() => setAssigningDeliveryId(delivery.id)}>
                            Assign Courier
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Assign Courier</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <Select onValueChange={setSelectedCourier} value={selectedCourier}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a courier" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCouriers.map((courier: Courier) => ( // Use Courier
                                  <SelectItem key={courier.id} value={courier.id}>
                                    {courier.fullName} ({courier.vehicleType})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              className="w-full"
                              onClick={handleAssign}
                              disabled={!selectedCourier || assignMutation.isPending}
                            >
                              {assignMutation.isPending ? "Assigning..." : "Confirm Assignment"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* {delivery.status === DeliveryStatus.ASSIGNED && (
                      <Button
                        className="w-full mt-4"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: delivery.id, status: DeliveryStatus.PICKED_UP, vendorOrderId: "TODO" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark as Picked Up
                      </Button>
                    )}

                    {delivery.status === DeliveryStatus.PICKED_UP && (
                      <Button
                        className="w-full mt-4"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: delivery.id, status: DeliveryStatus.ON_THE_WAY, vendorOrderId: "TODO" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark as On The Way
                      </Button>
                    )}

                    {delivery.status === DeliveryStatus.ON_THE_WAY && (
                      <Button
                        className="w-full mt-4"
                        variant="default"
                        onClick={() => updateStatusMutation.mutate({ id: delivery.id, status: DeliveryStatus.DELIVERED, vendorOrderId: "TODO" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        Mark as Delivered
                      </Button>
                    )} */}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Deliveries;
