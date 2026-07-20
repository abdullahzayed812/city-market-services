import { useState, useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { useToast } from "@/hooks/use-toast";

interface UseGlobalProductsOptions {
    initialLimit?: number;
    search?: string;
    enabled?: boolean;
}

export const useGlobalProducts = ({ initialLimit = 20, search, enabled = true }: UseGlobalProductsOptions = {}) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [limit] = useState(initialLimit);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching, isPlaceholderData, error } = useInfiniteQuery({
        queryKey: ["globalProducts", { search }],
        enabled,
        queryFn: async ({ pageParam = 1 }) => {
            const response = await adminApi.getGlobalProducts(pageParam, limit, search);

            return {
                products: response.data,
                currentPage: pageParam,
                hasMore: response.data.length === limit,
            };
        },
        getNextPageParam: (lastPage) => {
            return lastPage.hasMore ? lastPage.currentPage + 1 : undefined;
        },
        initialPageParam: 1,
        placeholderData: (previousData) => previousData,
    });

    const products = useMemo(() => data?.pages.flatMap((page) => page.products) || [], [data?.pages]);
    const hasMoreProducts = hasNextPage || false;

    const loadMoreProducts = useCallback(() => {
        if (hasMoreProducts && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasMoreProducts, isFetchingNextPage, fetchNextPage]);

    // --- Delete Global Product ---
    const deleteGlobalProductMutation = useMutation({
        mutationFn: (id: string) => adminApi.deleteGlobalProduct(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["globalProducts"] });
            toast({ title: "Success", description: "Global template deleted successfully." });
        },
        onError: (err: any) => {
            toast({ title: "Error", description: `Failed to delete template: ${err.message}`, variant: "destructive" });
        },
    });

    const deleteGlobalProduct = useCallback(
        (id: string) => {
            deleteGlobalProductMutation.mutate(id);
        },
        [deleteGlobalProductMutation],
    );

    return {
        products,
        isLoadingProducts: isLoading,
        isFetching,
        isPlaceholderData,
        isFetchingNextProductsPage: isFetchingNextPage,
        hasMoreProducts,
        loadMoreProducts,
        deleteGlobalProduct,
        error,
    };
};
