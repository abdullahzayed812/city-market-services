import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { deliveryService } from "@/services/api/delivery.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, User } from "lucide-react";

const Couriers = () => {
  const { t } = useTranslation();
  const { data: couriers = [], isLoading } = useQuery({
    queryKey: ["couriers"],
    queryFn: deliveryService.getAllCouriers,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  return (
    <div className="">
      <h1 className="text-3xl font-bold">{t("common.couriers")}</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {couriers.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-card border rounded-xl border-dashed">
            <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("common.no_couriers")}</p>
          </div>
        ) : (
          couriers.map((courier: any) => (
            <Card key={courier.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between bg-muted/30 py-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{courier.fullName}</CardTitle>
                </div>
                <Badge variant={courier.isActive ? "default" : "secondary"}>
                  {courier.isActive ? t("common.online") : t("common.offline")}
                </Badge>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">{t("common.email")}:</span> {courier.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">{t("common.phone")}:</span> {courier.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">{t("common.vehicle")}:</span> {courier.vehicleType} -{" "}
                    {courier.vehiclePlate}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">{t("common.rating")}:</span> {courier.rating} / 5
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">{t("common.total_deliveries")}:</span> {courier.totalDeliveries}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Couriers;
