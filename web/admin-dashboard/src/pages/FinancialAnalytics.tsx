import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Clock, CheckCircle, AlertCircle, History as LucideHistory } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateSettlementDialog } from "@/components/settlements/CreateSettlementDialog";
import { useToast } from "@/hooks/use-toast";

const FinancialAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);

  const { data: vendorsData } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: async () => {
      const response = await adminApi.getVendors();
      return response.data.data;
    },
  });

  // const { data: analyticsData, isLoading: isAnalyticsLoading } = useQuery({
  //   queryKey: ["financialAnalytics", selectedVendorId],
  //   queryFn: async () => {
  //     if (selectedVendorId === "all" || !selectedVendorId) return null;
  //     const response = await adminApi.getFinancialAnalytics(selectedVendorId);
  //     return response.data.data;
  //   },
  //   enabled: selectedVendorId !== "all",
  // });

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["pendingEarnings", selectedVendorId],
    queryFn: async () => {
      if (selectedVendorId === "all" || !selectedVendorId) return null;
      const response = await adminApi.getVendorPendingEarnings(selectedVendorId);
      return response.data.data;
    },
    enabled: selectedVendorId !== "all",
  });

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["vendorSettlements", selectedVendorId],
    queryFn: async () => {
      if (selectedVendorId === "all" || !selectedVendorId) return null;
      const response = await adminApi.getSettlements({ vendorId: selectedVendorId });
      return response.data.data;
    },
    enabled: selectedVendorId !== "all",
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => adminApi.markSettlementPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorSettlements"] });
      queryClient.invalidateQueries({ queryKey: ["platformFinancialOverview"] });
      toast({
        title: t("common.success"),
        description: t("financial.settlement_marked_paid"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("financial.failed_mark_paid"),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="">
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
        </div>
      </div>

      {selectedVendorId === "all" ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl border-gray-200 bg-gray-50/50">
          <AlertCircle className="h-10 w-10 text-gray-400 mb-2" />
          <p className="text-gray-500">
            {t("financial.please_select_vendor", "Please select a vendor to manage payouts and settlements.")}
          </p>
        </div>
      ) : isPendingLoading || isHistoryLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex border-b border-gray-200">
            <button
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "pending"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("pending")}
            >
              <Clock className="h-4 w-4" />
              {t("financial.pending_settlement")}
            </button>
            <button
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "history"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("history")}
            >
              <CheckCircle className="h-4 w-4" />
              {t("financial.settlement_history")}
            </button>
          </div>

          {activeTab === "pending" ? (
            <div className="grid gap-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-gradient-to-br from-orange-50 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-800">
                      {t("financial.unsettled_orders")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{pendingData?.unsettledOrders || 0}</div>
                    <p className="text-xs text-orange-600 mt-1">{t("financial.ready_for_settlement")}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-800">{t("financial.gross_revenue")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-900">
                      {t("common.currency", "EGP")} {pendingData?.totalRevenue?.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-blue-600 mt-1">{t("financial.total_order_value")}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-800">{t("financial.commission")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-900">
                      {t("common.currency", "EGP")} {pendingData?.totalCommission?.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-purple-600 mt-1">{t("financial.platform_commission")}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-emerald-800">{t("financial.net_payout")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-emerald-900">
                      {t("common.currency", "EGP")} {pendingData?.netPayout?.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">{t("financial.after_platform_commission")}</p>
                  </CardContent>
                </Card>
                <Card
                  className="flex items-center justify-center p-6 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer group"
                  onClick={() => setIsSettlementDialogOpen(true)}
                >
                  <div className="text-center">
                    <PlusCircle className="h-8 w-8 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-bold">{t("financial.create_settlement")}</span>
                  </div>
                </Card>
              </div>

              {/* Historical Analytics for context */}
              {/* <div className="mt-4">
                <h3 className="text-lg font-bold mb-4 text-gray-800">{t("financial.marketplace_context")}</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500">
                        {t("financial.total_lifetime_orders")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analyticsData?.totalOrders || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500">
                        {t("financial.avg_commission")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {analyticsData?.totalRevenue
                          ? ((analyticsData.platformCommission / analyticsData.totalRevenue) * 100).toFixed(1)
                          : 0}
                        %
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div> */}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("financial.settlement_id")}</TableHead>
                      <TableHead>{t("financial.period")}</TableHead>
                      <TableHead>{t("financial.revenue")}</TableHead>
                      <TableHead>{t("financial.commission")}</TableHead>
                      <TableHead>{t("financial.net_payout")}</TableHead>
                      <TableHead>{t("financial.orders")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("financial.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.id.split("-")[0]}...</TableCell>
                        <TableCell className="text-sm">
                          {new Date(s.periodStart).toLocaleDateString()} - {new Date(s.periodEnd).toLocaleDateString()}
                        </TableCell>
                        <TableCell>EGP {s.totalVendorRevenue.toLocaleString()}</TableCell>
                        <TableCell>EGP {s.totalCommission.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">EGP {s.netPayout.toLocaleString()}</TableCell>
                        <TableCell>{s.orderCount}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              s.status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {s.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {s.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              onClick={() => markPaidMutation.mutate(s.id)}
                              disabled={markPaidMutation.isPending}
                            >
                              {t("financial.mark_paid")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!historyData || historyData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                          <LucideHistory className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          {t("financial.no_settlement_history")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedVendorId !== "all" && (
        <CreateSettlementDialog
          isOpen={isSettlementDialogOpen}
          onClose={() => setIsSettlementDialogOpen(false)}
          vendorId={selectedVendorId}
          vendorName={vendorsData?.find((v: any) => v.id === selectedVendorId)?.shopName || ""}
          pendingData={pendingData}
        />
      )}
    </div>
  );
};

export default FinancialAnalytics;
