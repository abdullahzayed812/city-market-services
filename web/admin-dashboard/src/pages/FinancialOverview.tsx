import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";

const FinancialOverview: React.FC = () => {
  const { t } = useTranslation();
  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["adminRevenue"],
    queryFn: async () => {
      const response = await adminApi.getRevenue();
      return response.data;
    },
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.revenue")}</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("financial.total_revenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${revenueData?.totalRevenue?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <span className="text-emerald-500 flex items-center me-1">
                <ArrowUpRight className="h-3 w-3 me-0.5" />
                {t("financial.from_last_month", { percent: 12 })}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("financial.platform_commission")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${revenueData?.platformCommission?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <span className="text-emerald-500 flex items-center me-1">
                <ArrowUpRight className="h-3 w-3 me-0.5" />
                {t("financial.from_last_month", { percent: 8 })}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("financial.pending_payouts")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$850</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("financial.awaiting_payment", { count: 3 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("financial.recent_payouts")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("financial.payout_id")}</TableHead>
                <TableHead>{t("common.vendor")}</TableHead>
                <TableHead>{t("financial.amount")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("financial.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueData?.payouts?.map((payout: any) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-medium">{payout.id}</TableCell>
                  <TableCell>{payout.vendorName}</TableCell>
                  <TableCell>${payout.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={payout.status === "completed" ? "default" : "secondary"}>
                      {payout.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{payout.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialOverview;
