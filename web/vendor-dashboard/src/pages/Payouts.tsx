import { useTranslation } from "react-i18next";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Wallet } from "lucide-react";

const Payouts = () => {
    const { t } = useTranslation();
    const { summary, isLoading } = useDashboardData();

    if (isLoading) {
        return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
    }

    const platformCommission = summary.totalRevenue * 0.1; // Assuming 10% commission
    const netEarnings = summary.totalRevenue - platformCommission;

    return (
      <div className="space-y-6 animate-in fade-in zoom-in duration-500">
        <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("common.payouts")}</h1>
                <p className="text-muted-foreground">
                    {t("common.payout_subtitle")}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("dashboard.revenue")}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${summary.totalRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("common.platform_commission")} (10%)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">-${platformCommission.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="bg-primary text-primary-foreground">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t("common.net_earnings")}</CardTitle>
                        <Wallet className="h-4 w-4 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${netEarnings.toLocaleString()}</div>
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
                            <TableRow>
                                <TableCell className="font-medium">{t("common.current_month")}</TableCell>
                                <TableCell>{summary.todayOrdersCount}+</TableCell>
                                <TableCell>${summary.totalRevenue}</TableCell>
                                <TableCell className="text-end font-bold">${netEarnings}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default Payouts;
