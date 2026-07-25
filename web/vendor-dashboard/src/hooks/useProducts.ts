import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "@/services/api/product.service";
import { useAuth } from "@/components/AuthProvider";
import type { BulkAddVendorProductsFromGlobalItem } from "@city-market/shared";

const PAGE_SIZE = 20;

export const useProducts = () => {
  const { t } = useTranslation();
  const { vendor } = useAuth();
  const vendorId = vendor?.id;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const productsQuery = useQuery({
    queryKey: ["vendor-products", vendorId, page],
    queryFn: () => productService.getVendorProducts(vendorId!, page, PAGE_SIZE),
    enabled: !!vendorId,
  });

  const globalCategoriesQuery = useQuery({
    queryKey: ["global-categories"],
    queryFn: () => productService.getGlobalCategories(),
  });

  const vendorCategoriesQuery = useQuery({
    queryKey: ["vendor-categories", vendorId],
    queryFn: () => productService.getVendorCategories(vendorId!),
    enabled: !!vendorId,
  });

  const updateVendorProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productService.updateVendorProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast.success(t("products.product_updated_success"));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t("products.product_update_failed"));
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: ({ id, stock, weight }: { id: string; stock?: number; weight?: number }) =>
      productService.updateVendorProductStock(id, stock, weight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast.success(t("products.stock_updated_success"));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t("products.stock_update_failed"));
    },
  });

  const deleteVendorProductMutation = useMutation({
    mutationFn: (id: string) => productService.deleteVendorProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast.success(t("products.product_deleted_success"));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t("products.product_delete_failed"));
    },
  });

  const updateProductImageMutation = useMutation({
    mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) => productService.updateProductImage(id, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast.success(t("products.image_updated_success"));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t("products.image_update_failed"));
    },
  });

  const bulkAddProductsFromGlobalMutation = useMutation({
    mutationFn: ({ items, vendorCategoryId }: { items: BulkAddVendorProductsFromGlobalItem[]; vendorCategoryId?: string }) =>
      productService.bulkAddProductsFromGlobal(vendorId!, items, vendorCategoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    },
  });

  const bulkAddProductsFromCategoryMutation = useMutation({
    mutationFn: ({ globalCategoryId, vendorCategoryId }: { globalCategoryId: string; vendorCategoryId?: string }) =>
      productService.bulkAddProductsFromCategory(vendorId!, globalCategoryId, vendorCategoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    },
  });

  return {
    vendorId,
    products: productsQuery.data?.data || [],
    page,
    totalPages: Math.ceil((productsQuery.data?.total || 0) / PAGE_SIZE),
    setPage,
    globalCategories: globalCategoriesQuery.data || [],
    vendorCategories: vendorCategoriesQuery.data || [],
    isLoading: productsQuery.isLoading || globalCategoriesQuery.isLoading || vendorCategoriesQuery.isLoading,
    updateVendorProduct: updateVendorProductMutation.mutate,
    updateStock: updateStockMutation.mutate,
    deleteVendorProduct: deleteVendorProductMutation.mutate,
    updateProductImage: updateProductImageMutation.mutate,
    bulkAddProductsFromGlobal: bulkAddProductsFromGlobalMutation.mutateAsync,
    bulkAddProductsFromCategory: bulkAddProductsFromCategoryMutation.mutateAsync,
  };
};
