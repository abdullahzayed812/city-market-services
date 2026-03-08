import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Bike, Phone, User, Plus, Power, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CouriersManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCourier, setNewCourier] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    vehicleType: "Motorcycle",
    licensePlate: "",
  });

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
      setNewCourier({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        phone: "",
        vehicleType: "Motorcycle",
        licensePlate: "",
      });
      toast({ description: t("couriers.created_success") });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.response?.data?.message || t("common.error")
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.couriers")}</h2>
        <div className="flex gap-4 items-center">
          <Badge variant="outline" className="px-3 py-1">
            {t("couriers.available_couriers")}: {couriers?.filter((c) => c.isAvailable).length || 0}
          </Badge>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus size={16} />
                {t("couriers.add_new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t("couriers.add_new_title")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("auth.first_name")}</Label>
                    <Input
                      id="firstName"
                      value={newCourier.firstName}
                      onChange={(e) => setNewCourier({ ...newCourier, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("auth.last_name")}</Label>
                    <Input
                      id="lastName"
                      value={newCourier.lastName}
                      onChange={(e) => setNewCourier({ ...newCourier, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCourier.email}
                    onChange={(e) => setNewCourier({ ...newCourier, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newCourier.password}
                    onChange={(e) => setNewCourier({ ...newCourier, password: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("common.phone")}</Label>
                    <Input
                      id="phone"
                      value={newCourier.phone}
                      onChange={(e) => setNewCourier({ ...newCourier, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">{t("couriers.vehicle")}</Label>
                    <Select
                      value={newCourier.vehicleType}
                      onValueChange={(val) => setNewCourier({ ...newCourier, vehicleType: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="Car">Car</SelectItem>
                        <SelectItem value="Bicycle">Bicycle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licensePlate">{t("couriers.license_plate")}</Label>
                  <Input
                    id="licensePlate"
                    value={newCourier.licensePlate}
                    onChange={(e) => setNewCourier({ ...newCourier, licensePlate: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={() => createCourierMutation.mutate(newCourier)}
                  disabled={createCourierMutation.isPending}
                >
                  {createCourierMutation.isPending ? t("common.loading") : t("common.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
