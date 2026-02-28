import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bike, Phone, User, CheckCircle2, XCircle } from "lucide-react";

const CouriersManagement: React.FC = () => {
  const { t } = useTranslation();
  const { data: couriers, isLoading } = useQuery({
    queryKey: ["adminCouriers"],
    queryFn: async () => {
      const response = await adminApi.getCouriers();
      return response.data.data;
    },
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.couriers")}</h2>
        <Badge variant="outline" className="px-3 py-1">
          {t("couriers.available_couriers")}: {couriers?.filter(c => c.isAvailable).length || 0}
        </Badge>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("couriers.vehicle")}</TableHead>
              <TableHead>{t("couriers.phone")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {couriers?.map((courier) => (
              <TableRow key={courier.id}>
                <TableCell>
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center me-3 text-slate-500">
                      <User size={16} />
                    </div>
                    <span className="font-medium">{courier.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-gray-600">
                    <Bike size={14} className="me-2" />
                    {courier.vehicleType || "Motorcycle"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-gray-600">
                    <Phone size={14} className="me-2" />
                    {courier.phone}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={courier.isAvailable ? "default" : "secondary"}>
                    {courier.isAvailable ? t("common.active") : t("common.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="sm">
                    {t("common.edit")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CouriersManagement;
