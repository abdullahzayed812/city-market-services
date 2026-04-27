import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Clock, CheckCircle, AlertCircle, History as LucideHistory, Truck, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateSettlementDialog } from "@/components/settlements/CreateSettlementDialog";
import { CreateDeliverySettlementDialog } from "@/components/settlements/CreateDeliverySettlementDialog";
import { useToast } from "@/hooks/use-toast";

type Section = "vendors" | "couriers" | "offices";

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
    }`}
  >
    {status}
  </span>
);

// ─── Vendor Settlements ───────────────────────────────────────────────────────

const VendorSettlements: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: vendorsData } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: async () => (await adminApi.getVendors()).data.data,
  });

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["vendorPendingEarnings", selectedVendorId],
    queryFn: async () => (await adminApi.getVendorPendingEarnings(selectedVendorId)).data.data,
    enabled: selectedVendorId !== "all",
  });

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["vendorSettlements", selectedVendorId],
    queryFn: async () => (await adminApi.getSettlements({ vendorId: selectedVendorId })).data.data,
    enabled: selectedVendorId !== "all",
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => adminApi.markSettlementPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorSettlements"] });
      toast({ title: t("common.success"), description: t("financial.settlement_marked_paid") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.response?.data?.message || t("financial.failed_mark_paid"), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
          <SelectTrigger className="w-[220px] border-gray-300">
            <SelectValue placeholder={t("financial.select_vendor")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("financial.select_vendor")}</SelectItem>
            {vendorsData?.map((v: any) => (
              <SelectItem key={v.id} value={v.id}>{v.shopName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedVendorId === "all" ? (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl border-gray-200 bg-gray-50/50">
          <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-gray-500">{t("financial.please_select_vendor")}</p>
        </div>
      ) : isPendingLoading || isHistoryLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          <div className="flex border-b border-gray-200">
            {(["pending", "history"] as const).map((tab) => (
              <button
                key={tab}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "pending" ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {t(`financial.${tab === "pending" ? "pending_settlement" : "settlement_history"}`)}
              </button>
            ))}
          </div>

          {activeTab === "pending" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              <Card className="bg-gradient-to-br from-orange-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-800">{t("financial.unsettled_orders")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{pendingData?.unsettledOrders || 0}</div></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-800">{t("financial.gross_revenue")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-blue-900">EGP {pendingData?.totalRevenue?.toLocaleString() || 0}</div></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-purple-800">{t("financial.commission")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-purple-900">EGP {pendingData?.totalCommission?.toLocaleString() || 0}</div></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-800">{t("financial.net_payout")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-emerald-900">EGP {pendingData?.netPayout?.toLocaleString() || 0}</div></CardContent>
              </Card>
              <Card className="flex items-center justify-center p-6 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer group" onClick={() => setIsDialogOpen(true)}>
                <div className="text-center">
                  <PlusCircle className="h-8 w-8 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-bold">{t("financial.create_settlement")}</span>
                </div>
              </Card>
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
                        <TableCell className="text-sm">{new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}</TableCell>
                        <TableCell>EGP {s.totalVendorRevenue?.toLocaleString()}</TableCell>
                        <TableCell>EGP {s.totalCommission?.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">EGP {s.netPayout?.toLocaleString()}</TableCell>
                        <TableCell>{s.orderCount}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell>
                          {s.status === "PENDING" && (
                            <Button size="sm" variant="outline" className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" onClick={() => markPaidMutation.mutate(s.id)} disabled={markPaidMutation.isPending}>
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
        </>
      )}

      {selectedVendorId !== "all" && (
        <CreateSettlementDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          vendorId={selectedVendorId}
          vendorName={vendorsData?.find((v: any) => v.id === selectedVendorId)?.shopName || ""}
          pendingData={pendingData}
        />
      )}
    </div>
  );
};

// ─── Courier Settlements ──────────────────────────────────────────────────────

const CourierSettlementsSection: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCourierId, setSelectedCourierId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: couriersData } = useQuery({
    queryKey: ["adminCouriers"],
    queryFn: async () => (await adminApi.getCouriers()).data.data,
  });

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["courierPendingEarnings", selectedCourierId],
    queryFn: async () => (await adminApi.getCourierPendingEarnings(selectedCourierId)).data.data,
    enabled: selectedCourierId !== "all",
  });

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["courierSettlements", selectedCourierId],
    queryFn: async () => (await adminApi.getCourierSettlements({ courierId: selectedCourierId })).data.data,
    enabled: selectedCourierId !== "all",
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => adminApi.markCourierSettlementPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courierSettlements"] });
      toast({ title: t("common.success"), description: t("financial.settlement_marked_paid") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.response?.data?.message || t("financial.failed_mark_paid"), variant: "destructive" });
    },
  });

  const selectedCourier = couriersData?.find((c: any) => c.id === selectedCourierId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
          <SelectTrigger className="w-[220px] border-gray-300">
            <SelectValue placeholder={t("financial.select_courier", "Select a courier")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("financial.select_courier", "Select a courier")}</SelectItem>
            {couriersData?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCourierId === "all" ? (
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl border-gray-200 bg-gray-50/50">
          <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-gray-500">{t("financial.please_select_courier", "Please select a courier to manage settlements.")}</p>
        </div>
      ) : isPendingLoading || isHistoryLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          <div className="flex border-b border-gray-200">
            {(["pending", "history"] as const).map((tab) => (
              <button
                key={tab}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "pending" ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {t(`financial.${tab === "pending" ? "pending_settlement" : "settlement_history"}`)}
              </button>
            ))}
          </div>

          {activeTab === "pending" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-orange-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-800">{t("financial.unsettled_deliveries", "Unsettled Deliveries")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{pendingData?.unsettledDeliveries || 0}</div></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-800">{t("financial.delivery_fees", "Delivery Fees")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-blue-900">EGP {pendingData?.totalDeliveryFees?.toLocaleString() || 0}</div></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-800">{t("financial.net_payout")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-emerald-900">EGP {pendingData?.netPayout?.toLocaleString() || 0}</div></CardContent>
              </Card>
              <Card className="flex items-center justify-center p-6 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer group" onClick={() => setIsDialogOpen(true)}>
                <div className="text-center">
                  <PlusCircle className="h-8 w-8 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-bold">{t("financial.create_settlement")}</span>
                </div>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("financial.settlement_id")}</TableHead>
                      <TableHead>{t("financial.period")}</TableHead>
                      <TableHead>{t("financial.delivery_fees", "Delivery Fees")}</TableHead>
                      <TableHead>{t("financial.net_payout")}</TableHead>
                      <TableHead>{t("financial.deliveries", "Deliveries")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("financial.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.id.split("-")[0]}...</TableCell>
                        <TableCell className="text-sm">{new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}</TableCell>
                        <TableCell>EGP {s.totalDeliveryFees?.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">EGP {s.netPayout?.toLocaleString()}</TableCell>
                        <TableCell>{s.deliveryCount}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell>
                          {s.status === "PENDING" && (
                            <Button size="sm" variant="outline" className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" onClick={() => markPaidMutation.mutate(s.id)} disabled={markPaidMutation.isPending}>
                              {t("financial.mark_paid")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!historyData || historyData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-gray-500">
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
        </>
      )}

      {selectedCourierId !== "all" && (
        <CreateDeliverySettlementDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          type="courier"
          targetId={selectedCourierId}
          targetName={selectedCourier?.fullName || ""}
          pendingData={pendingData}
          queryKeyToInvalidate={["courierSettlements", selectedCourierId]}
        />
      )}
    </div>
  );
};

// ─── Office Settlements ───────────────────────────────────────────────────────

const OfficeSettlementsSection: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: officesData } = useQuery({
    queryKey: ["adminDeliveryOffices"],
    queryFn: async () => (await adminApi.getDeliveryOffices()).data.data,
  });

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["officePendingEarnings", selectedOfficeId],
    queryFn: async () => (await adminApi.getOfficePendingEarnings(selectedOfficeId === "all" ? undefined : selectedOfficeId)).data.data,
  });

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["officeSettlements", selectedOfficeId],
    queryFn: async () => (await adminApi.getOfficeSettlements({ deliveryOfficeId: selectedOfficeId === "all" ? undefined : selectedOfficeId })).data.data,
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => adminApi.markOfficeSettlementPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["officeSettlements"] });
      queryClient.invalidateQueries({ queryKey: ["officePendingEarnings"] });
      toast({ title: t("common.success"), description: t("financial.settlement_marked_paid") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.response?.data?.message || t("financial.failed_mark_paid"), variant: "destructive" });
    },
  });

  const selectedOffice = officesData?.find((o: any) => o.id === selectedOfficeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
          <SelectTrigger className="w-[220px] border-gray-300">
            <SelectValue placeholder={t("financial.all_offices", "All offices")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("financial.all_offices", "All offices")}</SelectItem>
            {officesData?.map((o: any) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPendingLoading || isHistoryLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          <div className="flex border-b border-gray-200">
            {(["pending", "history"] as const).map((tab) => (
              <button
                key={tab}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "pending" ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {t(`financial.${tab === "pending" ? "pending_settlement" : "settlement_history"}`)}
              </button>
            ))}
          </div>

          {activeTab === "pending" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-orange-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-800">{t("financial.unsettled_deliveries", "Unsettled Deliveries")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{pendingData?.unsettledDeliveries || 0}</div></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-800">{t("financial.delivery_fees", "Delivery Fees")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-blue-900">EGP {pendingData?.totalDeliveryFees?.toLocaleString() || 0}</div></CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-50 to-white">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-800">{t("financial.net_payout")}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-emerald-900">EGP {pendingData?.netPayout?.toLocaleString() || 0}</div></CardContent>
              </Card>
              <Card className="flex items-center justify-center p-6 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer group" onClick={() => setIsDialogOpen(true)}>
                <div className="text-center">
                  <PlusCircle className="h-8 w-8 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-bold">{t("financial.create_settlement")}</span>
                </div>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("financial.settlement_id")}</TableHead>
                      <TableHead>{t("financial.period")}</TableHead>
                      <TableHead>{t("financial.delivery_fees", "Delivery Fees")}</TableHead>
                      <TableHead>{t("financial.net_payout")}</TableHead>
                      <TableHead>{t("financial.deliveries", "Deliveries")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("financial.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.id.split("-")[0]}...</TableCell>
                        <TableCell className="text-sm">{new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}</TableCell>
                        <TableCell>EGP {s.totalDeliveryFees?.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">EGP {s.netPayout?.toLocaleString()}</TableCell>
                        <TableCell>{s.deliveryCount}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell>
                          {s.status === "PENDING" && (
                            <Button size="sm" variant="outline" className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" onClick={() => markPaidMutation.mutate(s.id)} disabled={markPaidMutation.isPending}>
                              {t("financial.mark_paid")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!historyData || historyData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-gray-500">
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
        </>
      )}

      <CreateDeliverySettlementDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        type="office"
        targetId={selectedOfficeId === "all" ? undefined : selectedOfficeId}
        targetName={selectedOffice?.name || t("financial.all_offices", "All offices")}
        pendingData={pendingData}
        queryKeyToInvalidate={["officeSettlements", selectedOfficeId]}
      />
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const FinancialAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("vendors");

  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "vendors", label: t("financial.vendor_settlements", "Vendor Settlements"), icon: <CheckCircle className="h-4 w-4" /> },
    { key: "couriers", label: t("financial.courier_settlements", "Courier Settlements"), icon: <Truck className="h-4 w-4" /> },
    { key: "offices", label: t("financial.office_settlements", "Office Settlements"), icon: <Building2 className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
        {t("financial.analytics", "Financial Settlements")}
      </h2>

      <div className="flex gap-2 border-b border-gray-200">
        {sections.map((s) => (
          <button
            key={s.key}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              section === s.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setSection(s.key)}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {section === "vendors" && <VendorSettlements />}
      {section === "couriers" && <CourierSettlementsSection />}
      {section === "offices" && <OfficeSettlementsSection />}
    </div>
  );
};

export default FinancialAnalytics;
