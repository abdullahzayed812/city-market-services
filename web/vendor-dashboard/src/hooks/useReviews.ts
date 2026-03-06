import { useQuery } from "@tanstack/react-query";
import { ratingService } from "@/services/api/rating.service";
import { useAuth } from "@/components/AuthProvider";

export const useReviews = () => {
    const { vendor } = useAuth();
    const vendorId = vendor?.id;

    const summaryQuery = useQuery({
        queryKey: ["vendor-rating-summary", vendorId],
        queryFn: () => ratingService.getVendorRatingSummary(vendorId!),
        enabled: !!vendorId,
    });

    const reviewsQuery = useQuery({
        queryKey: ["vendor-reviews", vendorId],
        queryFn: () => ratingService.getVendorReviews(vendorId!),
        enabled: !!vendorId,
    });

    return {
        summary: summaryQuery.data?.data || { averageRating: 0, totalRatings: 0 },
        reviews: reviewsQuery.data?.data || [],
        isLoading: summaryQuery.isLoading || reviewsQuery.isLoading,
        isError: summaryQuery.isError || reviewsQuery.isError,
        refetch: () => {
            summaryQuery.refetch();
            reviewsQuery.refetch();
        }
    };
};
