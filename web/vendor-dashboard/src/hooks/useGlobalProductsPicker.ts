import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/api/product.service";

interface UseGlobalProductsPickerOptions {
  search?: string;
  globalCategoryId?: string;
  enabled?: boolean;
  limit?: number;
}

export const useGlobalProductsPicker = ({ search, globalCategoryId, enabled = true, limit = 20 }: UseGlobalProductsPickerOptions = {}) => {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, globalCategoryId]);

  const { data, isLoading } = useQuery({
    queryKey: ["global-products-picker", { search, globalCategoryId, page }],
    enabled,
    queryFn: () => productService.getGlobalProducts(page, limit, search, globalCategoryId),
    placeholderData: (previousData) => previousData,
  });

  const products = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    products,
    total,
    isLoading,
    page,
    totalPages,
    setPage,
  };
};
