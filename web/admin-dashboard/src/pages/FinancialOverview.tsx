import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Wallet, Clock, History } from "lucide-react";

const FinancialOverview: React.FC = () => {
  const { t } = useTranslation();

  const { data: financialData, isLoading } = useQuery({
    queryKey: ["financialOverview"],
    queryFn: async () => {
      const response = await adminApi.getFinancialOverview();
      return response.data.data;
    },
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  const summaryCards = [
    {
      title: t("financial.total_revenue"),
      value: `$${financialData?.totalRevenue?.toLocaleString()}`,
      icon: DollarSign,
      color: "text-emerald-600",
      description: t("financial.from_last_month", { percent: 12 }),
    },
    {
      title: t("financial.platform_commission"),
      value: `$${financialData?.totalCommission?.toLocaleString()}`,
      icon: Wallet,
      color: "text-blue-600",
      description: "8.5% avg commission",
    },
    {
      title: t("financial.pending_payouts"),
      value: `$${financialData?.pendingPayouts?.toLocaleString()}`,
      icon: Clock,
      color: "text-orange-600",
      description: t("financial.awaiting_payment", { count: 5 }),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.revenue")}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-600">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-gray-500 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold">{t("financial.recent_payouts")}</CardTitle>
          <History className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("financial.payout_id")}</TableHead>
                <TableHead>{t("common.vendor")}</TableHead>
                <TableHead>{t("financial.amount")}</TableHead>
                <TableHead>{t("financial.date")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialData?.recentPayouts?.map((payout: any) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-mono text-xs">{payout.id}</TableCell>
                  <TableCell>{payout.vendorName}</TableCell>
                  <TableCell className="font-medium">${payout.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{payout.date}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      Paid
                    </span>
                  </TableCell>
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
