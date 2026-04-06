import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Category, CategoryType, type Vendor } from "@city-market/shared";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  vendors: Vendor[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}

const CategoryFormDialog: React.FC<CategoryFormDialogProps> = ({
  open,
  onOpenChange,
  category,
  vendors,
  onSubmit,
  isPending,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: CategoryType.GLOBAL,
    vendorId: "",
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || "",
        type: category.type || CategoryType.GLOBAL,
        vendorId: category.vendorId || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        type: CategoryType.GLOBAL,
        vendorId: "",
      });
    }
  }, [category, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      vendorId: formData.type === CategoryType.GLOBAL ? undefined : formData.vendorId,
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {category ? t("categories.edit_category") : t("categories.create_category")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {category ? t("categories.edit_description") : t("categories.create_description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t("common.type")}</Label>
              <Select
                value={formData.type}
                onValueChange={(val: CategoryType) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("categories.select_type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CategoryType.GLOBAL}>{t("categories.global")}</SelectItem>
                  <SelectItem value={CategoryType.VENDOR}>{t("categories.vendor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.type === CategoryType.VENDOR && (
              <div className="space-y-2">
                <Label htmlFor="vendor">{t("common.vendor")}</Label>
                <Select
                  value={formData.vendorId}
                  onValueChange={(val) => setFormData({ ...formData, vendorId: val })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("categories.select_vendor")} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.shopName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("common.description")}</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {category ? t("common.update") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryFormDialog;
