import React, { useState, useMemo, useCallback, useEffect, useDeferredValue, memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, X, Search, FileUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { useAdminProducts } from "@/hooks/useAdminProducts";
import { useGlobalProducts } from "@/hooks/useGlobalProducts";
import { type VendorProduct, type CreateVendorProductDto, CategoryType, type GlobalProduct } from "@city-market/shared";
import ProductImageModal from "@/components/ProductImageModal";
import ProductTable from "../features/products/components/ProductTable";
import GlobalProductTable from "../features/products/components/GlobalProductTable";
import ProductFormDialog from "../features/products/components/ProductFormDialog";
import BulkImportGlobalProductsDialog from "../features/products/components/BulkImportGlobalProductsDialog";

// 1. Isolate the Search Input to prevent parent re-renders while typing
const SearchFilter = memo(
  ({ initialValue, onDebouncedChange, isFetching }: { initialValue: string; onDebouncedChange: (val: string) => void; isFetching: boolean }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    useEffect(() => {
      if (value === initialValue) return;

      const handler = setTimeout(() => {
        if (value === "" || value.length >= 3) {
          onDebouncedChange(value);
        }
      }, 400);

      return () => clearTimeout(handler);
    }, [value, onDebouncedChange, initialValue]);

    return (
      <div className="w-full sm:w-[240px] space-y-1.5">
        <label className="text-xs font-medium text-gray-500 flex items-center justify-between">
          {t("common.search", "Search")}
          {isFetching && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t("products.search_placeholder", "Search products...")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pl-9 pr-8"
          />
          {value && (
            <button
              onClick={() => {
                setValue("");
                onDebouncedChange("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  },
);

const ProductsManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [selectedGlobalCategoryId, setSelectedGlobalCategoryId] = useState<string | undefined>(undefined);
  const [selectedVendorCategoryId, setSelectedVendorCategoryId] = useState<string | undefined>(undefined);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState<VendorProduct | GlobalProduct | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const deferredSearch = useDeferredValue(debouncedSearch);

  const [activeTab, setActiveTab] = useState("vendor");

  const {
    products,
    page: productsPage,
    totalPages: productsTotalPages,
    setPage: setProductsPage,
    categories,
    vendors,
    isLoadingProducts,
    isFetching,
    isPlaceholderData,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    updateProductImage,
  } = useAdminProducts({
    initialLimit: 20,
    globalCategoryId: selectedGlobalCategoryId,
    vendorCategoryId: selectedVendorCategoryId,
    vendorId: selectedVendorId,
    search: deferredSearch,
  });

  const {
    products: globalProducts,
    page: globalPage,
    totalPages: globalTotalPages,
    setPage: setGlobalPage,
    isFetching: isFetchingGlobal,
    deleteGlobalProduct,
  } = useGlobalProducts({
    initialLimit: 20,
    search: deferredSearch,
  });

  const globalCategories = useMemo(() => categories?.filter((c) => c.type === CategoryType.GLOBAL || !c.type) || [], [categories]);

  const vendorCategories = useMemo(() => {
    let filtered = categories?.filter((c) => c.type === CategoryType.VENDOR) || [];
    if (selectedVendorId) {
      filtered = filtered.filter((c) => c.vendorId === selectedVendorId);
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

  const handleFormSubmit = useCallback(
    (data: CreateVendorProductDto | Partial<VendorProduct>) => {
      if (editingProduct) {
        updateVendorProduct(editingProduct.id, data);
      } else {
        createVendorProduct(data as CreateVendorProductDto);
      }
      setIsDialogOpen(false);
    },
    [editingProduct, updateVendorProduct, createVendorProduct],
  );

  const handleToggleAvailability = useCallback(
    (product: VendorProduct) => {
      updateVendorProduct(product.id, { isAvailable: !product.isAvailable });
    },
    [updateVendorProduct],
  );

  const handleViewImage = useCallback((product: VendorProduct | GlobalProduct) => {
    setSelectedProductForImage(product);
    setIsImageModalOpen(true);
  }, []);

  const handleUploadImage = useCallback(
    (id: string, imageUrl: string) => {
      updateProductImage(id, imageUrl);
    },
    [updateProductImage],
  );

  const handleDeleteProduct = useCallback(
    (id: string) => {
      deleteVendorProduct(id);
    },
    [deleteVendorProduct],
  );

  const handleDeleteGlobalProduct = useCallback(
    (id: string) => {
      deleteGlobalProduct(id);
    },
    [deleteGlobalProduct],
  );

  if (isLoadingProducts && !isPlaceholderData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-muted-foreground">{t("common.loading")}</div>
        </div>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="gap-2">
            <FileUp className="h-4 w-4" /> {t("products.bulk_import", "Bulk Import")}
          </Button>
          <Button onClick={handleOpenAddDialog} className="gap-2">
            <Plus className="h-4 w-4" /> {t("products.add_new")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir={i18n.dir()}>
        <TabsList className="mb-6 grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="vendor">{t("products.vendor_listing", "Vendor Listings")}</TabsTrigger>
          <TabsTrigger value="global">{t("products.global_product", "Global Templates")}</TabsTrigger>
        </TabsList>

        <TabsContent value="vendor" className="space-y-6 mt-0">
          <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
            <SearchFilter initialValue={debouncedSearch} onDebouncedChange={setDebouncedSearch} isFetching={isFetching} />

            <div className="w-full sm:w-[220px] space-y-1.5">
              <label className="text-xs font-medium text-gray-500">{t("common.vendor")}</label>
              <Select
                value={selectedVendorId || "all"}
                onValueChange={(val) => {
                  const newVendorId = val === "all" ? undefined : val;
                  setSelectedVendorId(newVendorId);

                  if (selectedVendorCategoryId) {
                    const category = categories?.find((c) => c.id === selectedVendorCategoryId);
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
              <Select value={selectedGlobalCategoryId || "all"} onValueChange={(val) => setSelectedGlobalCategoryId(val === "all" ? undefined : val)}>
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
                    const cat = categories?.find((c) => c.id === val);
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
                        <span className="text-[10px] text-gray-400">{vendors?.find((v) => v.id === cat.vendorId)?.shopName || cat.vendorId}</span>
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
                setDebouncedSearch("");
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
            currentPage={productsPage}
            totalPages={productsTotalPages}
            onPageChange={setProductsPage}
          />
        </TabsContent>

        <TabsContent value="global" className="space-y-6 mt-0">
          <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
            <SearchFilter initialValue={debouncedSearch} onDebouncedChange={setDebouncedSearch} isFetching={isFetchingGlobal} />
            <Button
              variant="ghost"
              size="sm"
              className="mt-6 h-10 text-gray-500"
              onClick={() => {
                setDebouncedSearch("");
              }}
            >
              {t("common.reset", "Reset")}
            </Button>
          </div>

          <GlobalProductTable
            products={globalProducts}
            onDelete={handleDeleteGlobalProduct}
            onViewImage={handleViewImage}
            currentPage={globalPage}
            totalPages={globalTotalPages}
            onPageChange={setGlobalPage}
          />
        </TabsContent>
      </Tabs>

      <ProductFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        categories={categories || []}
        vendors={vendors || []}
        onSubmit={handleFormSubmit}
      />

      <BulkImportGlobalProductsDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} categories={categories || []} />

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

export default memo(ProductsManagement);
