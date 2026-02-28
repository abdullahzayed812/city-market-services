import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";

import { useAdminProducts } from "@/hooks/useAdminProducts";
import { type Product, type CreateProductDto, CategoryType } from "@city-market/shared";
import ProductImageModal from "@/components/ProductImageModal";
import ProductTable from "../features/products/components/ProductTable";
import ProductFormDialog from "../features/products/components/ProductFormDialog";

const ProductsManagement: React.FC = () => {
  const { t } = useTranslation();
  const [selectedGlobalCategoryId, setSelectedGlobalCategoryId] = useState<string | undefined>(undefined);
  const [selectedVendorCategoryId, setSelectedVendorCategoryId] = useState<string | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState<Product | null>(null);

  // We filter by both if provided. Note: our repo implementation uses a unified ProductFilter.
  const {
    products,
    categories,
    vendors,
    isLoadingProducts,
    isFetchingNextProductsPage,
    hasMoreProducts,
    loadMoreProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
  } = useAdminProducts({ 
    initialLimit: 20, 
    // Pass both category IDs to the hook (hook needs to be updated to support both)
    globalCategoryId: selectedGlobalCategoryId,
    vendorCategoryId: selectedVendorCategoryId
  });

  const globalCategories = useMemo(() => 
    categories?.filter(c => c.type === CategoryType.GLOBAL || !c.type) || [], 
    [categories]
  );

  const vendorCategories = useMemo(() => 
    categories?.filter(c => c.type === CategoryType.VENDOR) || [],
    [categories]
  );

  const handleOpenAddDialog = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleFormSubmit = (data: CreateProductDto | Partial<Product>) => {
    if (editingProduct) {
      updateProduct(editingProduct.id, data);
    } else {
      createProduct(data as CreateProductDto);
    }
    setIsDialogOpen(false);
  };

  const handleToggleAvailability = (product: Product) => {
    updateProduct(product.id, { isAvailable: !product.isAvailable });
  };

  const handleViewImage = (product: Product) => {
    setSelectedProductForImage(product);
    setIsImageModalOpen(true);
  };

  if (isLoadingProducts && !isFetchingNextProductsPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            onValueChange={(val) => setSelectedVendorCategoryId(val === "all" ? undefined : val)}
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
          }}
        >
          {t("common.reset", "Reset")}
        </Button>
      </div>

      <ProductTable
        products={products}
        onEdit={handleOpenEditDialog}
        onDelete={deleteProduct}
        onToggleAvailability={handleToggleAvailability}
        onUploadImage={uploadProductImage}
        onViewImage={handleViewImage}
        hasMore={hasMoreProducts}
        onLoadMore={loadMoreProducts}
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
        productName={selectedProductForImage?.name || "Product"}
      />
    </div>
  );
};

export default ProductsManagement;
