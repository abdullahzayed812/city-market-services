import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { EventType } from "@city-market/shared";
import { deliveryService } from "@/services/api/delivery.service";
import { useSocket } from "@/contexts/SocketContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Truck, User } from "lucide-react";
import { AddCourierDialog } from "@/features/couriers/components/AddCourierDialog";

const APPROVAL_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING_REVIEW: "outline",
  SUSPENDED: "destructive",
  REJECTED: "destructive",
};

const Couriers = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { data: couriers = [], isLoading } = useQuery({
    queryKey: ["couriers"],
    queryFn: deliveryService.getAllCouriers,
  });

  // Admin approved / rejected one of our courier requests
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["couriers"] });
    socket.on(EventType.COURIER_APPROVAL_UPDATED, refresh);
    return () => {
      socket.off(EventType.COURIER_APPROVAL_UPDATED, refresh);
    };
  }, [socket, queryClient]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  return (
    <div className="">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">{t("common.couriers")}</h1>
        <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
          <Plus size={16} />
          {t("add_courier.button")}
        </Button>
      </div>

      <AddCourierDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onCreated={() => {
          setIsAddOpen(false);
          queryClient.invalidateQueries({ queryKey: ["couriers"] });
        }}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {couriers.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-card border rounded-xl border-dashed">
            <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("common.no_couriers")}</p>
          </div>
        ) : (
          couriers.map((courier: any) => {
            const approved = !courier.approvalStatus || courier.approvalStatus === "APPROVED";
            return (
              <Card key={courier.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-muted/30 py-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{courier.fullName}</CardTitle>
                  </div>
                  {approved ? (
                    <Badge variant={courier.isAvailable ? "default" : "secondary"}>
                      {courier.isAvailable ? t("common.online") : t("common.offline")}
                    </Badge>
                  ) : (
                    <Badge variant={APPROVAL_BADGE[courier.approvalStatus] ?? "outline"}>
                      {t(`add_courier.approval_${courier.approvalStatus.toLowerCase()}`)}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">{t("common.phone")}:</span> {courier.phone}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">{t("common.vehicle")}:</span> {courier.vehicleType}
                      {courier.licensePlate ? ` - ${courier.licensePlate}` : ""}
                    </p>
                    {approved && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">{t("common.rating")}:</span>{" "}
                          {courier.ratingCount ? `${Number(courier.rating).toFixed(1)} / 5 (${courier.ratingCount})` : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">{t("common.total_deliveries")}:</span> {courier.totalDeliveries ?? 0}
                        </p>
                      </>
                    )}
                    {courier.approvalStatus === "PENDING_REVIEW" && (
                      <p className="text-xs text-muted-foreground">{t("add_courier.pending_hint")}</p>
                    )}
                    {courier.approvalStatus === "REJECTED" && (
                      <p className="text-xs text-destructive">{t("add_courier.rejected_hint")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Couriers;
