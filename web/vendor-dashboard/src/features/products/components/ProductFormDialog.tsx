import React, { useState, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MeasurementType } from "@city-market/shared";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  vendorCategories: any[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}

const ProductFormDialog: React.FC<ProductFormDialogProps> = memo(({
  open,
  onOpenChange,
  product,
  vendorCategories,
  onSubmit,
  isPending,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<any>({
    name: "",
    description: "",
    price: 0,
    stockQuantity: 0,
    stockWeightGrams: 0,
    globalCategoryId: "",
    vendorCategoryId: "",
    globalProductId: "",
    measurementType: MeasurementType.UNIT,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        id: product.id,
        name: product.name,
        description: product.description || "",
        price: product.price,
        stockQuantity: product.stockQuantity,
        stockWeightGrams: product.stockWeightGrams || 0,
        globalCategoryId: product.globalCategoryId,
        vendorCategoryId: product.vendorCategoryId,
        globalProductId: product.globalProductId,
        measurementType: product.measurementType || MeasurementType.UNIT,
      });
    }
  }, [product, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("products.edit_product")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("products.edit_product_description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-category">{t("products.store_category")}</Label>
              <Select
                value={formData.vendorCategoryId}
                onValueChange={(val) => setFormData({ ...formData, vendorCategoryId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("products.select_store_category")} />
                </SelectTrigger>
                <SelectContent>
                  {vendorCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">{formData.measurementType === MeasurementType.WEIGHT ? t("products.price_per_kg") : t("products.price")}</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">{formData.measurementType === MeasurementType.WEIGHT ? t("products.stock_grams") : t("products.stock")}</Label>
              <Input
                id="stock"
                type="number"
                value={formData.measurementType === MeasurementType.WEIGHT ? formData.stockWeightGrams : formData.stockQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (formData.measurementType === MeasurementType.WEIGHT) {
                    setFormData({ ...formData, stockWeightGrams: val });
                  } else {
                    setFormData({ ...formData, stockQuantity: val });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.loading") : t("products.update_product")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default ProductFormDialog;
