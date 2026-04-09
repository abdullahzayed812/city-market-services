import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ShoppingBag, Store, Truck, DollarSign } from "lucide-react";

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const response = await adminApi.getStats();
      return response.data.data;
    },
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  const cards = [
    { title: t("dashboard.total_users"), value: stats?.totalUsers, icon: Users, color: "text-blue-600" },
    { title: t("dashboard.total_orders"), value: stats?.totalOrders, icon: ShoppingBag, color: "text-emerald-600" },
    { title: t("dashboard.total_vendors"), value: stats?.totalVendors, icon: Store, color: "text-orange-600" },
    { title: t("dashboard.total_couriers"), value: stats?.totalCouriers, icon: Truck, color: "text-purple-600" },
    // {
    //   title: t("dashboard.total_revenue"),
    //   value: `$${stats?.totalRevenue?.toLocaleString()}`,
    //   icon: DollarSign,
    //   color: "text-indigo-600",
    // },
  ];

  return (
    <div className="">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("dashboard.overview")}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-600">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.revenue_summary")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-slate-50 rounded-md border-2 border-dashed">
            <p className="text-gray-400">{t("dashboard.revenue_chart_placeholder")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("common.actions")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-slate-50 rounded-md border-2 border-dashed">
            <p className="text-gray-400">{t("dashboard.recent_activity_placeholder")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
