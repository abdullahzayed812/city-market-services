import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "@/services/api/product.service";
import { useAuth } from "@/components/AuthProvider";

export const useProducts = () => {
  const { vendor } = useAuth();
  const vendorId = vendor?.id;
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["vendor-products", vendorId],
    queryFn: () => productService.getVendorProducts(vendorId!),
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

  const createVendorProductMutation = useMutation({
    mutationFn: (data: any) => productService.createVendorProduct({ ...data, vendorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  const updateVendorProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productService.updateVendorProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  const deleteVendorProductMutation = useMutation({
    mutationFn: (id: string) => productService.deleteVendorProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  const uploadVendorProductImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => productService.uploadVendorProductImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  const globalProductsQuery = useQuery({
    queryKey: ["global-products"],
    queryFn: () => productService.getGlobalProducts(1, 100),
  });

  return {
    products: productsQuery.data?.data || [],
    globalCategories: globalCategoriesQuery.data || [],
    vendorCategories: vendorCategoriesQuery.data || [],
    globalProducts: globalProductsQuery.data?.data || [],
    isLoading:
      productsQuery.isLoading ||
      globalCategoriesQuery.isLoading ||
      vendorCategoriesQuery.isLoading ||
      globalProductsQuery.isLoading,
    createVendorProduct: createVendorProductMutation.mutate,
    updateVendorProduct: updateVendorProductMutation.mutate,
    deleteVendorProduct: deleteVendorProductMutation.mutate,
    uploadVendorProductImage: uploadVendorProductImageMutation.mutate,
  };
};
