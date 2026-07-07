import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const [newCourier, setNewCourier] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    vehicleType: "Motorcycle",
    licensePlate: "",
  });

  const handleSubmit = () => {
    onSubmit(newCourier);
    setNewCourier({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      vehicleType: "Motorcycle",
      licensePlate: "",
    });
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
            disabled={isPending}
          >
            {isPending ? t("common.loading") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCourierDialog;
