import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { deliveryService } from "@/services/api/delivery.service";
import { Package, Truck, Clock } from "lucide-react";

const Dashboard = () => {
  const { t } = useTranslation();

  const { data: couriers = [] } = useQuery({
    queryKey: ["couriers"],
    queryFn: deliveryService.getAllCouriers,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["deliveries"],
    queryFn: deliveryService.getAllDeliveries,
  });

  const { data: pendingDeliveries = [] } = useQuery({
    queryKey: ["pending-deliveries"],
    queryFn: deliveryService.getPendingDeliveries,
  });

  const activeCouriers = couriers.filter((c: any) => c.isActive).length;
  const totalDeliveriesToday = deliveries.filter((d: any) => {
    const today = new Date().toISOString().split("T")[0];
    return d.createdAt?.startsWith(today);
  }).length;

  return (
    <div className="">
      <h1 className="text-3xl font-bold">{t("common.dashboard")}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-card border rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("dashboard.active_couriers")}</p>
            <p className="text-2xl font-bold mt-1">
              {activeCouriers} / {couriers.length}
            </p>
          </div>
        </div>
        <div className="p-6 bg-card border rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-full">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("dashboard.pending_deliveries")}</p>
            <p className="text-2xl font-bold mt-1">{pendingDeliveries.length}</p>
          </div>
        </div>
        <div className="p-6 bg-card border rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full">
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("dashboard.total_deliveries_today")}</p>
            <p className="text-2xl font-bold mt-1">{totalDeliveriesToday}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
