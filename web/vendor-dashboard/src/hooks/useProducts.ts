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

  const createProductMutation = useMutation({
    mutationFn: (data: any) => productService.createProduct({ ...data, vendorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productService.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => productService.uploadImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
    },
  });

  return {
    products: productsQuery.data?.products || [],
    globalCategories: globalCategoriesQuery.data || [],
    vendorCategories: vendorCategoriesQuery.data || [],
    isLoading: productsQuery.isLoading || globalCategoriesQuery.isLoading || vendorCategoriesQuery.isLoading,
    createProduct: createProductMutation.mutate,
    updateProduct: updateProductMutation.mutate,
    deleteProduct: deleteProductMutation.mutate,
    uploadImage: uploadImageMutation.mutate,
  };
};
