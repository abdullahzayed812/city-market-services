import { useState, useMemo, useCallback, memo, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { useProducts } from "@/hooks/useProducts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Image as ImageIcon, MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import VendorProductImageModal from "@/components/ProductImageModal";
import { MeasurementType } from "@city-market/shared";
import ProductFormDialog from "@/features/products/components/ProductFormDialog";

const Products = () => {
  const { t } = useTranslation();
  const [globalProductSearch, setGlobalProductSearch] = useState("");
  
  // Use deferred value for the search results fetch
  const deferredSearch = useDeferredValue(globalProductSearch);

  const {
    products,
    vendorCategories,
    globalProducts,
    isLoading,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    hasMoreProducts,
    isFetchingNextProductsPage,
    loadMoreProducts,
    isGlobalProductsLoading,
  } = useProducts(deferredSearch);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const handleCreateProduct = useCallback((data: any) => {
    const { measurementType, ...dto } = data;
    createVendorProduct(dto, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
      },
    });
  }, [createVendorProduct]);

  const handleUpdateProduct = useCallback((data: any) => {
    const { id, measurementType, ...rest } = data;
    updateVendorProduct(
      {
        id,
        data: rest,
      },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditingProduct(null);
        },
      },
    );
  }, [updateVendorProduct]);

  // Memoize the Table to prevent re-renders on every keystroke in the dialog
  const productList = useMemo(() => (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">{t("products.table.image")}</TableHead>
            <TableHead>{t("products.table.product")}</TableHead>
            <TableHead>{t("products.table.global_category")}</TableHead>
            <TableHead>{t("products.table.store_category")}</TableHead>
            <TableHead>{t("products.table.price")}</TableHead>
            <TableHead>{t("products.table.stock")}</TableHead>
            <TableHead>{t("products.table.status")}</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products?.map((product: any) => {
            if (!product) return null;
            return (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="relative h-12 w-12 overflow-hidden rounded bg-muted flex-shrink-0">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.globalCategoryName || t("common.none")}</TableCell>
                <TableCell>{product.vendorCategoryName || t("common.none")}</TableCell>
                <TableCell>
                  {t("common.currency")} {product.price}
                  <span className="text-[10px] text-muted-foreground block">
                    {product.measurementType === MeasurementType.WEIGHT
                      ? `/${t("inventory.units.kg")}`
                      : `/${t("products.unit_short") || "unit"}`}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={
                      (product.measurementType === MeasurementType.UNIT
                        ? product.stockQuantity
                        : product.stockWeightGrams) < 10
                        ? "text-destructive font-bold"
                        : ""
                    }
                  >
                    {product.measurementType === MeasurementType.UNIT
                      ? product.stockQuantity
                      : `${((product.stockWeightGrams || 0) / 1000).toFixed(2)} ${t("inventory.units.kg")}`}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={product.isAvailable ? "default" : "secondary"}>
                    {product.isAvailable ? t("products.available") : t("products.not_available")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => {
                          setEditingProduct(product);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> {t("products.edit_product")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-destructive"
                        onClick={() => deleteVendorProduct(product.id)}
                      >
                        <Trash2 className="h-4 w-4" /> {t("products.delete_product")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
          {products?.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {t("products.no_products_found")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  ), [products, t, deleteVendorProduct]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("products.title")}</h1>
          <p className="text-muted-foreground">{t("products.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t("products.add_product")}
        </Button>
      </div>

      <ProductFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        isCreate={true}
        product={null}
        globalProducts={globalProducts}
        vendorCategories={vendorCategories}
        onSubmit={handleCreateProduct}
        isPending={false}
        onSearchGlobal={setGlobalProductSearch}
        isGlobalProductsLoading={isGlobalProductsLoading}
      />

      <ProductFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        product={editingProduct}
        globalProducts={globalProducts}
        vendorCategories={vendorCategories}
        onSubmit={handleUpdateProduct}
        isPending={false}
      />

      {productList}

      {hasMoreProducts && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => loadMoreProducts()} disabled={isFetchingNextProductsPage}>
            {isFetchingNextProductsPage ? t("common.loading", "Loading...") : t("common.load_more", "Load More")}
          </Button>
        </div>
      )}

      <VendorProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false);
          setSelectedProduct(null);
        }}
        imageUrl={selectedProduct?.imageUrl || null}
        productName={selectedProduct?.name || t("products.table.product")}
      />
    </div>
  );
};

export default memo(Products);
