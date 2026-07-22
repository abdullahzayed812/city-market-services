import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "@/services/api/product.service";
import { useAuth } from "@/components/AuthProvider";
import type { BulkAddVendorProductsFromGlobalItem } from "@city-market/shared";

const PAGE_SIZE = 20;

export const useProducts = () => {
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
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: ({ id, stock, weight }: { id: string; stock?: number; weight?: number }) =>
      productService.updateVendorProductStock(id, stock, weight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    },
  });

  const deleteVendorProductMutation = useMutation({
    mutationFn: (id: string) => productService.deleteVendorProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    },
  });

  const updateProductImageMutation = useMutation({
    mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) => productService.updateProductImage(id, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    },
  });

  const bulkAddProductsFromGlobalMutation = useMutation({
    mutationFn: (items: BulkAddVendorProductsFromGlobalItem[]) => productService.bulkAddProductsFromGlobal(vendorId!, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    },
  });

  const bulkAddProductsFromCategoryMutation = useMutation({
    mutationFn: (globalCategoryId: string) => productService.bulkAddProductsFromCategory(vendorId!, globalCategoryId),
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
