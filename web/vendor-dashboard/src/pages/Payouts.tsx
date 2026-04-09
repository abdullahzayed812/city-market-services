import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Wallet } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

import { useQuery } from "@tanstack/react-query";
import { orderService } from "@/services/api/order.service";

const Payouts = () => {
  const { t } = useTranslation();
  const { vendor } = useAuth();
  const vendorId = vendor?.id;

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["pendingEarnings", vendorId],
    queryFn: () => orderService.getPendingEarnings(vendorId!),
    enabled: !!vendorId,
  });

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["vendorSettlements", vendorId],
    queryFn: () => orderService.getSettlements(vendorId!),
    enabled: !!vendorId,
  });

  if (isPendingLoading || isHistoryLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  const totalRevenue = pendingData?.totalRevenue || 0;
  const platformCommission = pendingData?.totalCommission || 0;
  const netEarnings = pendingData?.netPayout || 0;

  return (
    <div className="">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("common.payouts")}</h1>
        <p className="text-muted-foreground">{t("common.payout_subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.revenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {t("common.currency", "EGP")} {totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("common.platform_commission", "Platform Commission")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              -{t("common.currency", "EGP")} {platformCommission.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("common.net_earnings")}</CardTitle>
            <Wallet className="h-4 w-4 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {t("common.currency", "EGP")} {netEarnings.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.earnings_history")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.period")}</TableHead>
                <TableHead>{t("common.orders")}</TableHead>
                <TableHead>{t("dashboard.revenue")}</TableHead>
                <TableHead className="text-end">{t("common.net_earnings")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyData?.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {new Date(s.periodStart).toLocaleDateString()} - {new Date(s.periodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{s.orderCount}</TableCell>
                  <TableCell>
                    {t("common.currency", "EGP")} {s.totalVendorRevenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-end font-bold">
                    {t("common.currency", "EGP")} {s.netPayout.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {(!historyData || historyData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-400">
                    {t("common.no_payout_history")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Payouts;
