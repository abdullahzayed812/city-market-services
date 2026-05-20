import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Star, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RatingService } from "@/services/api/ratingService";
import { VendorService } from "@/services/api/vendorService";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";

function StarDisplay({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= stars ? "fill-accent text-accent" : "text-gray-200 fill-gray-200"} />
      ))}
    </div>
  );
}

export default function VendorReviewsPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();

  const { data: vendor } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: () => VendorService.getVendorById(vendorId!),
    enabled: !!vendorId,
  });

  const { data: summary } = useQuery({
    queryKey: ["vendor-rating", vendorId],
    queryFn: () => RatingService.getSummary(vendorId!),
    enabled: !!vendorId,
  });

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ["vendor-reviews", vendorId],
    queryFn: () => RatingService.getReviews(vendorId!, 20, 0),
    enabled: !!vendorId,
  });

  const reviews = reviewsData?.data?.ratings ?? [];
  const avgRating = summary?.data?.averageRating ? Number(summary.data.averageRating) : 0;
  const totalRatings = summary?.data?.totalRatings ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-text-primary tracking-tight flex-1">Reviews</h1>
      </div>

      {/* Rating summary */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-5">
        <h2 className="font-bold text-text-primary mb-4">{vendor?.shopName}</h2>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-black text-text-primary">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
            <StarDisplay stars={Math.round(avgRating)} />
            <p className="text-xs text-text-muted mt-1">{totalRatings} reviews</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = summary?.data?.ratingDistribution?.[n] ?? 0;
              const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
              return (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-3">{n}</span>
                  <Star size={10} className="fill-accent text-accent flex-shrink-0" />
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-text-muted w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 bg-primary-xlight rounded-full flex items-center justify-center mb-3">
            <MessageSquare size={28} className="text-primary" strokeWidth={1.5} />
          </div>
          <p className="font-bold text-text-primary">No reviews yet</p>
          <p className="text-sm text-text-muted">Be the first to review this store</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-white text-xs font-bold">
                    {(r.customerName || "U")[0].toUpperCase()}
                  </div>
                  <p className="text-sm font-bold text-text-primary">{r.customerName || "Customer"}</p>
                </div>
                <StarDisplay stars={r.stars} />
              </div>
              {r.comment && <p className="text-sm text-text-secondary leading-relaxed">{r.comment}</p>}
              <p className="text-xs text-text-muted mt-2">{formatDate(r.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
