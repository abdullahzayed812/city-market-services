import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bike, Phone, User, Plus, Power, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CreateCourierDialog from "@/features/couriers/components/CreateCourierDialog";

const CouriersManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: couriers, isLoading } = useQuery({
    queryKey: ["adminCouriers"],
    queryFn: async () => {
      const response = await adminApi.getCouriers();
      return response.data.data;
    },
  });

  const createCourierMutation = useMutation({
    mutationFn: (data: any) => adminApi.registerCourier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCouriers"] });
      setIsCreateDialogOpen(false);
      toast({ description: t("couriers.created_success") });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.response?.data?.message || t("common.error"),
      });
    },
  });

  const deactivateCourierMutation = useMutation({
    mutationFn: (id: string) => adminApi.deactivateCourier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCouriers"] });
      toast({ description: t("couriers.status_updated") });
    },
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.couriers")}</h2>
        <div className="flex gap-4 items-center">
          <Badge variant="outline" className="px-3 py-1">
            {t("couriers.available_couriers")}: {couriers?.filter((c) => c.isAvailable).length || 0}
          </Badge>
          <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus size={16} />
            {t("couriers.add_new")}
          </Button>

          <CreateCourierDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSubmit={(data) => createCourierMutation.mutate(data)}
            isPending={createCourierMutation.isPending}
          />
        </div>
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
                    <span className="font-medium">{courier.fullName}</span>
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
                  <Badge variant={courier.isActive ? "default" : "secondary"}>
                    {courier.isActive ? t("common.active") : t("common.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="sm" onClick={() => deactivateCourierMutation.mutate(courier.id)}>
                    {courier.isActive ? (
                      <>
                        <PowerOff size={14} className="me-2 text-destructive" />
                        {t("common.deactivate")}
                      </>
                    ) : (
                      <>
                        <Power size={14} className="me-2 text-emerald-600" />
                        {t("common.activate")}
                      </>
                    )}
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
