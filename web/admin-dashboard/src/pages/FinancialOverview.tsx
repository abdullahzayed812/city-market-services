import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const FinancialOverview: React.FC = () => {
  const { t } = useTranslation();

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["revenue"],
    queryFn: async () => {
      try {
        const response = await adminApi.getRevenue();
        return response?.data?.data;
      } catch (error) {
        // Mock data
        return {
          totalRevenue: 25000,
          platformCommission: 2500,
          payouts: [
            { id: "P-001", vendorName: "The Corner Store", amount: 1200, status: "completed", date: "2026-01-14" },
            { id: "P-002", vendorName: "Fresh Market", amount: 850, status: "pending", date: "2026-01-14" },
            { id: "P-003", vendorName: "Tech Haven", amount: 2100, status: "completed", date: "2026-01-13" },
          ],
        };
      }
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.revenue")}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
              <h3 className="text-2xl font-bold text-gray-900">${revenueData?.totalRevenue}</h3>
            </div>
            <div className="p-2 bg-green-100 text-green-600 rounded-md">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <ArrowUpRight className="h-4 w-4 me-1" />
            <span>12% from last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Platform Commission</p>
              <h3 className="text-2xl font-bold text-gray-900">${revenueData?.platformCommission}</h3>
            </div>
            <div className="p-2 bg-blue-100 text-blue-600 rounded-md">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-blue-600">
            <ArrowUpRight className="h-4 w-4 me-1" />
            <span>8% from last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Payouts</p>
              <h3 className="text-2xl font-bold text-gray-900">$850</h3>
            </div>
            <div className="p-2 bg-orange-100 text-orange-600 rounded-md">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-orange-600">
            <span>3 vendors awaiting payment</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Recent Payouts</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payout ID</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revenueData?.payouts.map((payout: any) => (
              <TableRow key={payout.id}>
                <TableCell className="font-medium">{payout.id}</TableCell>
                <TableCell>{payout.vendorName}</TableCell>
                <TableCell>${payout.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={payout.status === "completed" ? "default" : "outline"}>{payout.status}</Badge>
                </TableCell>
                <TableCell>{payout.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FinancialOverview;
