import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ShoppingBag, Truck, Store } from "lucide-react";

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

  const statCards = [
    { title: t("dashboard.total_users"), value: stats?.totalUsers, icon: Users, color: "text-blue-600" },
    { title: t("dashboard.total_orders"), value: stats?.totalOrders, icon: ShoppingBag, color: "text-emerald-600" },
    { title: t("dashboard.total_vendors"), value: stats?.totalVendors, icon: Store, color: "text-orange-600" },
    { title: t("dashboard.total_couriers"), value: stats?.totalCouriers, icon: Truck, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("dashboard.overview")}</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t("dashboard.revenue_summary")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-md m-4">
            <p className="text-gray-400">{t("dashboard.revenue_chart_placeholder")}</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t("common.actions")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-md m-4">
            <p className="text-gray-400">{t("dashboard.recent_activity_placeholder")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
