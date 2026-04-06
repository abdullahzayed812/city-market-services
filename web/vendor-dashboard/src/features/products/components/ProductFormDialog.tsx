import React, { useState, useEffect } from "react";
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
  globalProducts: any[];
  globalCategories: any[];
  vendorCategories: any[];
  onSubmit: (data: any) => void;
  isPending: boolean;
  isCreate?: boolean;
}

const ProductFormDialog: React.FC<ProductFormDialogProps> = ({
  open,
  onOpenChange,
  product,
  globalProducts,
  globalCategories,
  vendorCategories,
  onSubmit,
  isPending,
  isCreate = false,
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
    } else if (isCreate) {
      setFormData({
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
    }
  }, [product, open, isCreate]);

  const handleGlobalProductSelect = (id: string) => {
    const selected = globalProducts.find((p: any) => p.id === id);
    if (selected) {
      setFormData({
        ...formData,
        globalProductId: id,
        name: selected.name,
        description: selected.description || "",
        globalCategoryId: selected.globalCategoryId,
        measurementType: selected.measurementType || MeasurementType.UNIT,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? t("products.add_new_product") : t("products.edit_product")}</DialogTitle>
          <DialogDescription className="sr-only">
            {isCreate ? t("products.add_product_description") : t("products.edit_product_description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto">
          {isCreate && (
            <div className="space-y-2">
              <Label htmlFor="global-product-select">{t("products.link_to_global")}</Label>
              <Select
                value={formData.globalProductId}
                onValueChange={handleGlobalProductSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("products.select_existing")} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {globalProducts.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("products.global_catalog_info")}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t("products.product_name")}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("products.measurement_type")}</Label>
              <Select
                value={formData.measurementType}
                onValueChange={(val) => setFormData({ ...formData, measurementType: val as MeasurementType })}
                disabled={true}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MeasurementType.UNIT}>{t("products.unit")}</SelectItem>
                  <SelectItem value={MeasurementType.WEIGHT}>{t("products.weight")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="global-category">{t("products.global_category")}</Label>
              <Select
                value={formData.globalCategoryId}
                onValueChange={(val) => setFormData({ ...formData, globalCategoryId: val })}
                disabled={true}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("products.select_global_category")} />
                </SelectTrigger>
                <SelectContent>
                  {globalCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <div className="space-y-2">
            <Label htmlFor="description">{t("products.description")}</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.loading") : (isCreate ? t("products.create_product") : t("products.update_product"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormDialog;
