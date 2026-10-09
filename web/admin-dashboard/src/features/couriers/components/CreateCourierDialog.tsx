import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateCourierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}

const CreateCourierDialog: React.FC<CreateCourierDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}) => {
  const { t } = useTranslation();
  const emptyCourier = {
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    vehicleType: "Motorcycle",
    licensePlate: "",
    courierType: "OFFICE" as "OFFICE" | "FREELANCE",
    deliveryOfficeId: "",
  };
  const [newCourier, setNewCourier] = useState(emptyCourier);

  const { data: offices } = useQuery({
    // Only approved offices can take couriers
    queryKey: ["deliveryOffices", "APPROVED"],
    queryFn: async () => (await adminApi.getDeliveryOffices("APPROVED")).data.data ?? [],
    enabled: open,
  });

  // Office couriers must belong to an office; freelancers never do
  const missingOffice = newCourier.courierType === "OFFICE" && !newCourier.deliveryOfficeId;

  const handleSubmit = () => {
    const { deliveryOfficeId, ...rest } = newCourier;
    onSubmit(rest.courierType === "OFFICE" ? { ...rest, deliveryOfficeId } : rest);
    setNewCourier(emptyCourier);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("couriers.add_new_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("couriers.courier_type")}</Label>
              <Select
                value={newCourier.courierType}
                onValueChange={(val) => setNewCourier({ ...newCourier, courierType: val as "OFFICE" | "FREELANCE", deliveryOfficeId: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFICE">{t("couriers.type_office")}</SelectItem>
                  <SelectItem value="FREELANCE">{t("couriers.type_freelance")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newCourier.courierType === "OFFICE" && (
              <div className="space-y-2">
                <Label>{t("couriers.delivery_office")}</Label>
                <Select value={newCourier.deliveryOfficeId} onValueChange={(val) => setNewCourier({ ...newCourier, deliveryOfficeId: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("couriers.select_office")} />
                  </SelectTrigger>
                  <SelectContent>
                    {offices?.map((office: any) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
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
            <PasswordInput
              id="password"
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || missingOffice}
          >
            {isPending ? t("common.loading") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCourierDialog;
