import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { ShoppingBag, Users, Store, Truck, DollarSign } from "lucide-react";

const StatCard: React.FC<{ title: string; value: string | number; icon: any; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
    <div className={`p-3 rounded-full ${color} text-white me-4`}>
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  // Mocking data for now since backend might not be running
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      try {
        const response = await adminApi.getStats();
        return response?.data?.data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
      } catch (error: any) {
        // Return mock data if API fails
        return {
          totalOrders: 1250,
          totalUsers: 5400,
          totalVendors: 120,
          totalCouriers: 45,
          revenueToday: 25000,
        };
      }
    },
  });

  if (isLoading) return <div>{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("dashboard.overview")}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard
          title={t("dashboard.total_orders")}
          value={stats?.totalOrders ?? 0}
          icon={ShoppingBag}
          color="bg-blue-500"
        />
        <StatCard title={t("dashboard.total_users")} value={stats?.totalUsers ?? 0} icon={Users} color="bg-green-500" />
        <StatCard title={t("dashboard.total_vendors")} value={stats?.totalVendors ?? 0} icon={Store} color="bg-purple-500" />
        <StatCard
          title={t("dashboard.total_couriers")}
          value={stats?.totalCouriers ?? 0}
          icon={Truck}
          color="bg-orange-500"
        />
        <StatCard
          title={t("common.revenue")}
          value={`$${stats?.revenueToday ?? 0}`}
          icon={DollarSign}
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-64 flex items-center justify-center">
          <p className="text-gray-400">Revenue Chart Placeholder</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-64 flex items-center justify-center">
          <p className="text-gray-400">Recent Activity Placeholder</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
