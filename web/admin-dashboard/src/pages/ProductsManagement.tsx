import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAdminProducts } from "@/hooks/useAdminProducts";
import { type Product, type CreateProductDto } from "@city-market/shared";
import ProductImageModal from "@/components/ProductImageModal";
import ProductTable from "../features/products/components/ProductTable";
import ProductFormDialog from "../features/products/components/ProductFormDialog";

const ProductsManagement: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState<Product | null>(null);

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
  } = useAdminProducts({ initialLimit: 20, categoryId: selectedCategoryId });

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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="w-full sm:w-[200px]">
            <Select
              value={selectedCategoryId || "all"}
              onValueChange={(val) => setSelectedCategoryId(val === "all" ? undefined : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("products.filter_by_category", "Filter by Category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all_categories", "All Categories")}</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleOpenAddDialog} className="gap-2">
            <Plus className="h-4 w-4" /> {t("products.add_new")}
          </Button>
        </div>
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
