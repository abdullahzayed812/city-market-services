import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { useToast } from "@/hooks/use-toast";

interface UseGlobalProductsOptions {
    initialLimit?: number;
    search?: string;
    globalCategoryId?: string;
    enabled?: boolean;
}

export const useGlobalProducts = ({ initialLimit = 20, search, globalCategoryId, enabled = true }: UseGlobalProductsOptions = {}) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [limit] = useState(initialLimit);
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [search, globalCategoryId]);

    const { data, isLoading, isFetching, isPlaceholderData, error } = useQuery({
        queryKey: ["globalProducts", { search, globalCategoryId, page }],
        enabled,
        queryFn: () => adminApi.getGlobalProducts(page, limit, search, globalCategoryId),
        placeholderData: (previousData) => previousData,
    });

    const products = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

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
        total,
        page,
        totalPages,
        setPage,
        isLoadingProducts: isLoading,
        isFetching,
        isPlaceholderData,
        deleteGlobalProduct,
        error,
    };
};
