import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { productService } from "@/services/api/product.service";

interface UseGlobalProductsPickerOptions {
  search?: string;
  enabled?: boolean;
  limit?: number;
}

export const useGlobalProductsPicker = ({ search, enabled = true, limit = 20 }: UseGlobalProductsPickerOptions = {}) => {
  const [pageLimit] = useState(limit);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["global-products-picker", { search }],
    enabled,
    queryFn: async ({ pageParam = 1 }) => {
      const response = await productService.getGlobalProducts(pageParam, pageLimit, search);
      const products = response?.data || [];
      return {
        products,
        currentPage: pageParam,
        hasMore: products.length === pageLimit,
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.currentPage + 1 : undefined),
    initialPageParam: 1,
    placeholderData: (previousData) => previousData,
  });

  const products = useMemo(() => data?.pages.flatMap((page) => page.products) || [], [data?.pages]);

  return {
    products,
    isLoading,
    isFetchingNextPage,
    hasMore: hasNextPage || false,
    loadMore: fetchNextPage,
  };
};
