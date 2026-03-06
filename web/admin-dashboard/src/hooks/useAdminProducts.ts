import { useState, useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import type { VendorProduct, CreateVendorProductDto } from "@city-market/shared";
import { useToast } from "@/hooks/use-toast";

interface UseAdminProductsOptions {
  initialLimit?: number;
  globalCategoryId?: string;
  vendorCategoryId?: string;
  vendorId?: string;
}

export const useAdminProducts = ({
  initialLimit = 20,
  globalCategoryId,
  vendorCategoryId,
  vendorId,
}: UseAdminProductsOptions = {}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [limit] = useState(initialLimit);

  // --- Fetching Vendor Products ---
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } = useInfiniteQuery({
    queryKey: ["adminProducts", { globalCategoryId, vendorCategoryId, vendorId }],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await adminApi.getVendorProducts(pageParam, limit, { globalCategoryId, vendorCategoryId, vendorId });
      return {
        products: response.data,
        currentPage: pageParam,
        hasMore: response.hasMore,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.currentPage + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const products = useMemo(() => data?.pages.flatMap((page) => page.products) || [], [data?.pages]);
  const hasMoreProducts = hasNextPage || false;

  const loadMoreProducts = useCallback(() => {
    if (hasMoreProducts && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasMoreProducts, isFetchingNextPage, fetchNextPage]);

  // --- Fetching Categories ---
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const response = await adminApi.getCategories();
      return response.data.data;
    },
  });

  // --- Fetching Vendors ---
  const { data: vendors, isLoading: isLoadingVendors } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: async () => {
      const response = await adminApi.getVendors();
      return response.data.data;
    },
  });

  // --- Create Vendor Product ---
  const createVendorProductMutation = useMutation({
    mutationFn: (newProduct: CreateVendorProductDto) => adminApi.createVendorProduct(newProduct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Vendor product created successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to create vendor product: ${err.message}`, variant: "destructive" });
    },
  });

  const createVendorProduct = useCallback(
    (product: CreateVendorProductDto) => {
      createVendorProductMutation.mutate(product);
    },
    [createVendorProductMutation],
  );

  // --- Update Vendor Product ---
  const updateVendorProductMutation = useMutation({
    mutationFn: ({ id, data: updatedData }: { id: string; data: Partial<VendorProduct> }) =>
      adminApi.updateVendorProduct(id, updatedData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Vendor product updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to update vendor product: ${err.message}`, variant: "destructive" });
    },
  });

  const updateVendorProduct = useCallback(
    (id: string, data: Partial<VendorProduct>) => {
      updateVendorProductMutation.mutate({ id, data });
    },
    [updateVendorProductMutation],
  );

  // --- Delete Vendor Product ---
  const deleteVendorProductMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteVendorProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Vendor product deleted successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to delete vendor product: ${err.message}`, variant: "destructive" });
    },
  });

  const deleteVendorProduct = useCallback(
    (id: string) => {
      deleteVendorProductMutation.mutate(id);
    },
    [deleteVendorProductMutation],
  );

  // --- Upload Vendor Product Image ---
  const uploadVendorProductImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => adminApi.uploadVendorProductImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Vendor product image uploaded successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to upload image: ${err.message}`, variant: "destructive" });
    },
  });

  const uploadVendorProductImage = useCallback(
    (id: string, file: File) => {
      uploadVendorProductImageMutation.mutate({ id, file });
    },
    [uploadVendorProductImageMutation],
  );

  return {
    products,
    categories,
    vendors,
    isLoadingProducts: isLoading,
    isLoadingCategories,
    isLoadingVendors,
    isFetchingNextProductsPage: isFetchingNextPage,
    hasMoreProducts,
    loadMoreProducts,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    uploadVendorProductImage,
    error,
  };
};
