import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Courier } from "@city-market/shared";

interface AssignCourierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCouriers: Courier[];
  onAssign: (courierId: string) => void;
  isPending: boolean;
}

const AssignCourierDialog: React.FC<AssignCourierDialogProps> = ({
  open,
  onOpenChange,
  availableCouriers,
  onAssign,
  isPending,
}) => {
  const { t } = useTranslation();
  const [selectedCourier, setSelectedCourier] = useState<string>("");

  const handleConfirm = () => {
    if (selectedCourier) {
      onAssign(selectedCourier);
      setSelectedCourier("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("common.assign")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select onValueChange={setSelectedCourier} value={selectedCourier}>
            <SelectTrigger>
              <SelectValue placeholder={t("common.select_courier")} />
            </SelectTrigger>
            <SelectContent>
              {availableCouriers.map((courier: Courier) => (
                <SelectItem key={courier.id} value={courier.id}>
                  {courier.fullName} ({courier.vehicleType})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={!selectedCourier || isPending}
          >
            {isPending ? t("common.assigning") : t("common.confirm_assignment")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignCourierDialog;
