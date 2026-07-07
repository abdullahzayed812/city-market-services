import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const VENDOR_TYPES = [
  "Supermarket",
  "VegFruit",
  "Pharmacy",
  "Butcher",
  "Poultry",
  "Fish",
  "Roastery",
  "Bakery",
  "Pastry",
  "Stationery",
];

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: any | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
  isCreate?: boolean;
}

const VendorFormDialog: React.FC<VendorFormDialogProps> = ({
  open,
  onOpenChange,
  vendor,
  onSubmit,
  isPending,
  isCreate = false,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<any>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    shopName: "",
    shopDescription: "",
    phone: "",
    address: "",
    type: "Supermarket",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    if (vendor) {
      setFormData({
        ...vendor,
      });
    } else if (isCreate) {
      setFormData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        shopName: "",
        shopDescription: "",
        phone: "",
        address: "",
        type: "Supermarket",
        latitude: "",
        longitude: "",
      });
    }
  }, [vendor, open, isCreate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isCreate ? t("vendors.add_new_title") : t("common.edit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
          {isCreate && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("auth.first_name")}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("auth.last_name")}</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <PasswordInput
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="shopName">{t("vendors.shop_name")}</Label>
            <Input
              id="shopName"
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("common.phone")}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{t("vendors.type")}</Label>
              <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("categories.select_type")} />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`vendors.types.${type.toLowerCase()}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t("vendors.address")}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">{t("vendors.latitude") || "Latitude"}</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="e.g. 24.7136"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">{t("vendors.longitude") || "Longitude"}</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="e.g. 46.6753"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("common.description")}</Label>
            <Input
              id="description"
              value={formData.shopDescription}
              onChange={(e) => setFormData({ ...formData, shopDescription: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.loading") : isCreate ? t("common.create") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VendorFormDialog;
