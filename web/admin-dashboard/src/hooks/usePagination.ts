import { useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

interface UsePaginationOptions<T> {
  queryKey: string[];
  fetchFn: (pageParam: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>;
  initialLimit?: number;
}

const usePagination = <T>({ queryKey, fetchFn, initialLimit = 10 }: UsePaginationOptions<T>) => {
  const [limit] = useState(initialLimit);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetchFn(pageParam, limit);
      return {
        data: response.data,
        currentPage: pageParam,
        hasMore: response.hasMore,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.currentPage + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const allData = data?.pages.flatMap(page => page.data) || [];
  const hasMore = hasNextPage || false;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  return {
    data: allData,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasMore,
    loadMore,
  };
};

export default usePagination;
