import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAdminProducts } from "@/hooks/useAdminProducts";
import { type VendorProduct, type CreateVendorProductDto, CategoryType } from "@city-market/shared";
import ProductImageModal from "@/components/ProductImageModal";
import ProductTable from "../features/products/components/ProductTable";
import ProductFormDialog from "../features/products/components/ProductFormDialog";

const ProductsManagement: React.FC = () => {
  const { t } = useTranslation();
  const [selectedGlobalCategoryId, setSelectedGlobalCategoryId] = useState<string | undefined>(undefined);
  const [selectedVendorCategoryId, setSelectedVendorCategoryId] = useState<string | undefined>(undefined);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState<VendorProduct | null>(null);

  // We filter by both if provided. Note: our repo implementation uses a unified ProductFilter.
  const {
    products,
    categories,
    vendors,
    isLoadingProducts,
    isFetchingNextProductsPage,
    hasMoreProducts,
    loadMoreProducts,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    uploadVendorProductImage,
  } = useAdminProducts({
    initialLimit: 20,
    // Pass both category IDs and vendor ID to the hook
    globalCategoryId: selectedGlobalCategoryId,
    vendorCategoryId: selectedVendorCategoryId,
    vendorId: selectedVendorId
  });

  const globalCategories = useMemo(() =>
    categories?.filter(c => c.type === CategoryType.GLOBAL || !c.type) || [],
    [categories]
  );

  const vendorCategories = useMemo(() => {
    let filtered = categories?.filter(c => c.type === CategoryType.VENDOR) || [];
    if (selectedVendorId) {
      filtered = filtered.filter(c => c.vendorId === selectedVendorId);
    }
    return filtered;
  }, [categories, selectedVendorId]);

  const handleOpenAddDialog = useCallback(() => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  }, []);

  const handleOpenEditDialog = useCallback((product: VendorProduct) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  }, []);

  const handleFormSubmit = useCallback((data: CreateVendorProductDto | Partial<VendorProduct>) => {
    if (editingProduct) {
      updateVendorProduct(editingProduct.id, data);
    } else {
      createVendorProduct(data as CreateVendorProductDto);
    }
    setIsDialogOpen(false);
  }, [editingProduct, updateVendorProduct, createVendorProduct]);

  const handleToggleAvailability = useCallback((product: VendorProduct) => {
    updateVendorProduct(product.id, { isAvailable: !product.isAvailable });
  }, [updateVendorProduct]);

  const handleViewImage = useCallback((product: VendorProduct) => {
    setSelectedProductForImage(product);
    setIsImageModalOpen(true);
  }, []);

  const handleUploadImage = useCallback((id: string, file: File) => {
    uploadVendorProductImage(id, file);
  }, [uploadVendorProductImage]);

  const handleDeleteProduct = useCallback((id: string) => {
    deleteVendorProduct(id);
  }, [deleteVendorProduct]);

  const handleLoadMore = useCallback(() => {
    loadMoreProducts();
  }, [loadMoreProducts]);

  if (isLoadingProducts && !isFetchingNextProductsPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("common.products")}</h1>
          <p className="text-muted-foreground">{t("products.manage_catalog")}</p>
        </div>
        <Button onClick={handleOpenAddDialog} className="gap-2">
          <Plus className="h-4 w-4" /> {t("products.add_new")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="w-full sm:w-[220px] space-y-1.5">
          <label className="text-xs font-medium text-gray-500">{t("common.vendor")}</label>
          <Select
            value={selectedVendorId || "all"}
            onValueChange={(val) => {
              const newVendorId = val === "all" ? undefined : val;
              setSelectedVendorId(newVendorId);
              
              // Reset vendor category if it doesn't belong to the new vendor
              if (selectedVendorCategoryId) {
                const category = categories?.find(c => c.id === selectedVendorCategoryId);
                if (newVendorId && category?.vendorId !== newVendorId) {
                  setSelectedVendorCategoryId(undefined);
                }
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("products.select_vendor", "Filter by Vendor")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all", "All")}</SelectItem>
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.shopName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-[220px] space-y-1.5">
          <label className="text-xs font-medium text-gray-500">{t("common.global_category")}</label>
          <Select
            value={selectedGlobalCategoryId || "all"}
            onValueChange={(val) => setSelectedGlobalCategoryId(val === "all" ? undefined : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("products.filter_by_global", "Filter by Global Category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all", "All")}</SelectItem>
              {globalCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-[220px] space-y-1.5">
          <label className="text-xs font-medium text-gray-500">{t("common.vendor_category")}</label>
          <Select
            value={selectedVendorCategoryId || "all"}
            onValueChange={(val) => {
              if (val === "all") {
                setSelectedVendorCategoryId(undefined);
              } else {
                setSelectedVendorCategoryId(val);
                // Also set vendor if not set or different
                const cat = categories?.find(c => c.id === val);
                if (cat && cat.vendorId && cat.vendorId !== selectedVendorId) {
                  setSelectedVendorId(cat.vendorId);
                }
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("products.filter_by_vendor_cat", "Filter by Store Category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all", "All")}</SelectItem>
              {vendorCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex flex-col">
                    <span>{cat.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {vendors?.find(v => v.id === cat.vendorId)?.shopName || cat.vendorId}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-6 h-10 text-gray-500"
          onClick={() => {
            setSelectedGlobalCategoryId(undefined);
            setSelectedVendorCategoryId(undefined);
            setSelectedVendorId(undefined);
          }}
        >
          {t("common.reset", "Reset")}
        </Button>
      </div>

      <ProductTable
        products={products}
        onEdit={handleOpenEditDialog}
        onDelete={handleDeleteProduct}
        onToggleAvailability={handleToggleAvailability}
        onUploadImage={handleUploadImage}
        onViewImage={handleViewImage}
        hasMore={hasMoreProducts}
        onLoadMore={handleLoadMore}
        isFetchingNextPage={isFetchingNextProductsPage}
      />

      <ProductFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        categories={categories || []}
        vendors={vendors || []}
        onSubmit={handleFormSubmit}
      />

      <ProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false);
          setSelectedProductForImage(null);
        }}
        imageUrl={selectedProductForImage?.imageUrl || null}
        productName={selectedProductForImage?.name || t("common.product")}
      />
    </div>
  );
};

export default ProductsManagement;
