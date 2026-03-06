import React, { useState, useEffect, useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type VendorProduct, type CreateVendorProductDto, type Category, type Vendor, type GlobalProduct, CategoryType } from "@city-market/shared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi } from "@/services/api/admin-api";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: VendorProduct | null;
  categories: Category[];
  vendors: Vendor[];
  onSubmit: (data: any) => void;
}

const ProductFormDialog: React.FC<ProductFormDialogProps> = memo(({
  open,
  onOpenChange,
  product,
  categories,
  vendors,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [productType, setProductType] = useState<"global" | "vendor">("vendor");
  const [availableGlobalProducts, setAvailableGlobalProducts] = useState<GlobalProduct[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [formData, setFormData] = useState<CreateVendorProductDto & { globalProductId?: string }>({
    name: "",
    description: "",
    price: 0,
    stockQuantity: 0,
    globalCategoryId: "",
    vendorCategoryId: "",
    vendorId: "",
    globalProductId: "",
  });

  useEffect(() => {
    // Only fetch if dialog is open, we're in vendor mode, it's a new product, 
    // and we haven't fetched them yet or it's been some time.
    if (open && productType === "vendor" && !product && availableGlobalProducts.length === 0) {
      fetchGlobalProducts();
    }
  }, [open, productType, product, availableGlobalProducts.length]);

  const fetchGlobalProducts = async () => {
    setIsLoadingGlobal(true);
    try {
      const response = await adminApi.getGlobalProducts(1, 100);
      setAvailableGlobalProducts(response.data);
    } catch (error) {
      console.error("Failed to fetch global products", error);
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  useEffect(() => {
    if (product) {
      setProductType("vendor");
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        stockQuantity: product.stockQuantity,
        globalCategoryId: product.globalCategoryId || "",
        vendorCategoryId: product.vendorCategoryId || "",
        vendorId: product.vendorId || "",
        globalProductId: (product as any).globalProductId || "",
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
        globalProductId: "",
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
    if (productType === "global") {
      // Dedicated global product creation
      adminApi.createGlobalProduct({
        name: formData.name,
        description: formData.description,
        globalCategoryId: formData.globalCategoryId,
      }).then(() => onOpenChange(false));
    } else {
      onSubmit(formData);
    }
  };

  const handleGlobalProductSelect = (id: string) => {
    const selected = availableGlobalProducts.find(p => p.id === id);
    if (selected) {
      setFormData({
        ...formData,
        globalProductId: id,
        name: selected.name,
        description: selected.description || "",
        globalCategoryId: selected.globalCategoryId,
      });
    } else {
      setFormData({
        ...formData,
        globalProductId: "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{product ? t("products.edit_product") : t("products.add_new_product")}</DialogTitle>
          <DialogDescription className="sr-only">
            {product ? t("products.edit_product_description", "Edit current product details.") : t("products.add_product_description", "Create a new product listing in the catalog.")}
          </DialogDescription>
        </DialogHeader>

        {!product && (
          <Tabs value={productType} onValueChange={(v: string) => setProductType(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vendor">{t("products.vendor_listing")}</TabsTrigger>
              <TabsTrigger value="global">{t("products.global_product")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
          {productType === "vendor" && !product && (
            <div className="space-y-2">
              <Label htmlFor="global-product-select">{t("products.link_to_global")}</Label>
              <Select
                value={formData.globalProductId || "none"}
                onValueChange={handleGlobalProductSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingGlobal ? t("common.loading") : t("products.select_existing")} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  <SelectItem value="none">{t("products.none_create_new")}</SelectItem>
                  {availableGlobalProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("products.link_hint")}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={!!formData.globalProductId && formData.globalProductId !== "none"}
            />
          </div>

          {productType === "vendor" && (
            <div className="space-y-2">
              <Label htmlFor="vendor">{t("common.vendor")}</Label>
              <Select
                value={formData.vendorId}
                onValueChange={(val) => setFormData({ ...formData, vendorId: val, vendorCategoryId: "" })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("products.select_vendor")} />
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="global-category">{t("common.global_category")}</Label>
              <Select
                value={formData.globalCategoryId}
                onValueChange={(val) => setFormData({ ...formData, globalCategoryId: val })}
                required
                disabled={!!formData.globalProductId && formData.globalProductId !== "none"}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("products.select_global_category")} />
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

            {productType === "vendor" && (
              <div className="space-y-2">
                <Label htmlFor="vendor-category">{t("common.vendor_category")}</Label>
                <Select
                  value={formData.vendorCategoryId}
                  onValueChange={(val) => setFormData({ ...formData, vendorCategoryId: val })}
                  required
                  disabled={!formData.vendorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.vendorId ? t("products.select_store_category") : t("products.select_vendor_first")} />
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
            )}
          </div>

          {productType === "vendor" && (
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
          )}

          <div className="space-y-2">
            <Label htmlFor="description">{t("common.description")}</Label>
            <Input
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!!formData.globalProductId && formData.globalProductId !== "none"}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full">
              {product
                ? t("products.update_product")
                : (productType === "global" ? t("products.create_global") : t("products.create_listing"))
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default ProductFormDialog;
