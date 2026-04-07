import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Wallet, Activity, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const FinancialAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");

  const { data: vendorsData } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: async () => {
      const response = await adminApi.getVendors();
      return response.data.data;
    },
  });

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["financialAnalytics", selectedVendorId, periodStart, periodEnd],
    queryFn: async () => {
      if (selectedVendorId === "all" || !selectedVendorId) return null;
      const response = await adminApi.getFinancialAnalytics(selectedVendorId, { periodStart, periodEnd });
      return response.data.data;
    },
    enabled: selectedVendorId !== "all",
  });

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          {t("financial.analytics", "Financial Analytics")}
        </h2>
        <div className="flex items-center gap-4">
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger className="w-[200px] border-gray-300">
              <SelectValue placeholder={t("financial.select_vendor", "Select a vendor")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("financial.select_vendor", "Select a vendor")}</SelectItem>
              {vendorsData?.map((vendor: any) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.shopName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 items-center text-sm">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              className="p-2 border rounded-md"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <span className="text-gray-500">{t("common.to")}</span>
            <input
              type="date"
              className="p-2 border rounded-md"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          {(periodStart || periodEnd) && (
            <Button
              variant="outline"
              onClick={() => {
                setPeriodStart("");
                setPeriodEnd("");
              }}
            >
              {t("financial.reset_dates")}
            </Button>
          )}
        </div>
      </div>

      {selectedVendorId === "all" ? (
        <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-xl border-gray-200">
          <p className="text-gray-500">
            {t("financial.please_select_vendor", "Please select a vendor to view deep analytics.")}
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("financial.total_orders", "Total Orders")}
              </CardTitle>
              <Activity className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {analyticsData?.totalOrders?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("financial.gross_revenue", "Gross Revenue (Subtotal)")}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                ${analyticsData?.totalRevenue?.toLocaleString() || "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-indigo-800">
                {t("financial.platform_commission", "Platform Commission")}
              </CardTitle>
              <Wallet className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-900">
                ${analyticsData?.platformCommission?.toLocaleString() || "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-orange-50 to-red-50 border-orange-100 flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">
                {t("financial.delivery_fees", "Delivery Fees")}
              </CardTitle>
              <ExternalLink className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900">
                ${analyticsData?.totalDeliveryFees?.toLocaleString() || "0.00"}
              </div>
              <p className="text-xs text-red-700/80 mt-1">
                {analyticsData?.totalDeliveries || 0} {t("financial.deliveries_completed")}
              </p>
            </CardContent>
          </Card>

          {/* <Card className="md:col-span-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white border-0">
            <CardHeader>
              <CardTitle className="text-lg font-medium opacity-90">
                {t("financial.net_revenue", "Vendor Net Revenue")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-5xl font-extrabold tracking-tight">
                ${analyticsData?.netRevenue?.toLocaleString() || "0.00"}
              </div>
            </CardContent>
          </Card> */}
        </div>
      )}
    </div>
  );
};

export default FinancialAnalytics;
