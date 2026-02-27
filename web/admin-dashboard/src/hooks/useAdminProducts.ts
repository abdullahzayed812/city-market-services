import { useState, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import type { Product, CreateProductDto } from "@city-market/shared";
import { useToast } from "@/hooks/use-toast";

interface UseAdminProductsOptions {
  initialLimit?: number;
  categoryId?: string;
}

export const useAdminProducts = ({ initialLimit = 20, categoryId }: UseAdminProductsOptions = {}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [limit] = useState(initialLimit);

  // --- Fetching Products ---
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } = useInfiniteQuery({
    queryKey: ["adminProducts", { categoryId }],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await adminApi.getProducts(pageParam, limit, categoryId);
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

  const products = data?.pages.flatMap((page) => page.products) || [];
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

  // --- Create Product ---
  const createProductMutation = useMutation({
    mutationFn: (newProduct: CreateProductDto) => adminApi.createProduct(newProduct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Product created successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to create product: ${err.message}`, variant: "destructive" });
    },
  });

  const createProduct = useCallback(
    (product: CreateProductDto) => {
      createProductMutation.mutate(product);
    },
    [createProductMutation],
  );

  // --- Update Product ---
  const updateProductMutation = useMutation({
    mutationFn: ({ id, data: updatedData }: { id: string; data: Partial<Product> }) =>
      adminApi.updateProduct(id, updatedData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Product updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to update product: ${err.message}`, variant: "destructive" });
    },
  });

  const updateProduct = useCallback(
    (id: string, data: Partial<Product>) => {
      updateProductMutation.mutate({ id, data });
    },
    [updateProductMutation],
  );

  // --- Delete Product ---
  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Product deleted successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to delete product: ${err.message}`, variant: "destructive" });
    },
  });

  const deleteProduct = useCallback(
    (id: string) => {
      deleteProductMutation.mutate(id);
    },
    [deleteProductMutation],
  );

  // --- Upload Product Image ---
  const uploadProductImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => adminApi.uploadProductImage(id, file), // This API method needs to be created
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Product image uploaded successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to upload image: ${err.message}`, variant: "destructive" });
    },
  });

  const uploadProductImage = useCallback(
    (id: string, file: File) => {
      uploadProductImageMutation.mutate({ id, file });
    },
    [uploadProductImageMutation],
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
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
    error,
  };
};
