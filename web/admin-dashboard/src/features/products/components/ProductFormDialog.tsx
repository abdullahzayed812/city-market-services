import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Product, type CreateProductDto, type Category, type Vendor, CategoryType } from "@city-market/shared";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: Category[];
  vendors: Vendor[];
  onSubmit: (data: any) => void;
}

const ProductFormDialog: React.FC<ProductFormDialogProps> = ({
  open,
  onOpenChange,
  product,
  categories,
  vendors,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<CreateProductDto>({
    name: "",
    description: "",
    price: 0,
    stockQuantity: 0,
    globalCategoryId: "",
    vendorCategoryId: "",
    vendorId: "",
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        stockQuantity: product.stockQuantity,
        globalCategoryId: product.globalCategoryId || "",
        vendorCategoryId: product.vendorCategoryId || "",
        vendorId: product.vendorId || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        price: 0,
        stockQuantity: 0,
        globalCategoryId: "",
        vendorCategoryId: "",
        vendorId: "",
      });
    }
  }, [product, open]);

  const globalCategories = useMemo(() => 
    categories.filter(c => c.type === CategoryType.GLOBAL || !c.type), 
    [categories]
  );

  const vendorCategories = useMemo(() => 
    categories.filter(c => c.type === CategoryType.VENDOR && c.vendorId === formData.vendorId),
    [categories, formData.vendorId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{product ? t("products.edit_product") : t("products.add_new_product")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
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
            <Label htmlFor="vendor">{t("common.vendor", "Vendor")}</Label>
            <Select
              value={formData.vendorId}
              onValueChange={(val) => setFormData({ ...formData, vendorId: val, vendorCategoryId: "" })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder={t("products.select_vendor", "Select Vendor")} />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
                {vendors?.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.shopName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="global-category">{t("common.global_category", "Global Category")}</Label>
              <Select
                value={formData.globalCategoryId}
                onValueChange={(val) => setFormData({ ...formData, globalCategoryId: val })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("products.select_global_category", "Select Global Category")} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {globalCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-category">{t("common.vendor_category", "Store Category")}</Label>
              <Select
                value={formData.vendorCategoryId}
                onValueChange={(val) => setFormData({ ...formData, vendorCategoryId: val })}
                required
                disabled={!formData.vendorId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.vendorId ? t("products.select_store_category", "Select Store Category") : t("products.select_vendor_first", "Select Vendor First")} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {vendorCategories.map((cat) => (
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
              <Label htmlFor="price">{t("common.price")} ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">{t("common.stock")}</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("common.description")}</Label>
            <Input
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full">
              {product ? t("products.update_product") : t("products.create_product")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormDialog;
