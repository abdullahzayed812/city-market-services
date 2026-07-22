import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import type { VendorProduct, CreateVendorProductDto } from "@city-market/shared";
import { useToast } from "@/hooks/use-toast";

interface UseAdminProductsOptions {
  initialLimit?: number;
  globalCategoryId?: string;
  vendorCategoryId?: string;
  vendorId?: string;
  search?: string;
}

export const useAdminProducts = ({ initialLimit = 20, globalCategoryId, vendorCategoryId, vendorId, search }: UseAdminProductsOptions = {}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [limit] = useState(initialLimit);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [globalCategoryId, vendorCategoryId, vendorId, search]);

  // --- Fetching Vendor Products ---
  const { data, isLoading, isFetching, isPlaceholderData, error } = useQuery({
    queryKey: ["adminProducts", { globalCategoryId, vendorCategoryId, vendorId, search, page }],
    queryFn: () => adminApi.getVendorProducts(page, limit, { globalCategoryId, vendorCategoryId, vendorId, search }),
    placeholderData: (previousData) => previousData,
  });

  const products = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

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
    mutationFn: ({ id, data: updatedData }: { id: string; data: Partial<VendorProduct> }) => adminApi.updateVendorProduct(id, updatedData),
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

  // --- Update Vendor Product Image URL ---
  const updateProductImageMutation = useMutation({
    mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) => adminApi.updateVendorProductImage(id, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      toast({ title: "Success", description: "Product image updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to update image: ${err.message}`, variant: "destructive" });
    },
  });

  const updateProductImage = useCallback(
    (id: string, imageUrl: string) => {
      updateProductImageMutation.mutate({ id, imageUrl });
    },
    [updateProductImageMutation],
  );

  return {
    products,
    total,
    page,
    totalPages,
    setPage,
    categories,
    vendors,
    isLoadingProducts: isLoading,
    isFetching,
    isPlaceholderData,
    isLoadingCategories,
    isLoadingVendors,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    updateProductImage,
    error,
  };
};
