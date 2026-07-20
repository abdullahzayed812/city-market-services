import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { productService } from "@/services/api/product.service";
import { useAuth } from "@/components/AuthProvider";
import type { BulkAddVendorProductsFromGlobalItem } from "@city-market/shared";

export const useProducts = () => {
  const { vendor } = useAuth();
  const vendorId = vendor?.id;
  const queryClient = useQueryClient();

  const productsQuery = useInfiniteQuery({
    queryKey: ["vendor-products", "infinite", vendorId],
    queryFn: ({ pageParam = 1 }) => productService.getVendorProducts(vendorId!, pageParam, 20),
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.data || typeof lastPage.total !== "number") return undefined;
      const { page, limit, total } = lastPage;
      if (page * limit < total) {
        return page + 1;
      }
      return undefined;
    },
    enabled: !!vendorId,
    initialPageParam: 1,
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

  return {
    vendorId,
    products: productsQuery.data?.pages.flatMap((page) => page?.data || []) || [],
    hasMoreProducts: !!productsQuery.hasNextPage,
    isFetchingNextProductsPage: productsQuery.isFetchingNextPage,
    loadMoreProducts: productsQuery.fetchNextPage,
    globalCategories: globalCategoriesQuery.data || [],
    vendorCategories: vendorCategoriesQuery.data || [],
    isLoading: productsQuery.isLoading || globalCategoriesQuery.isLoading || vendorCategoriesQuery.isLoading,
    updateVendorProduct: updateVendorProductMutation.mutate,
    updateStock: updateStockMutation.mutate,
    deleteVendorProduct: deleteVendorProductMutation.mutate,
    updateProductImage: updateProductImageMutation.mutate,
    bulkAddProductsFromGlobal: bulkAddProductsFromGlobalMutation.mutateAsync,
  };
};
