/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslation } from "react-i18next";
import { useReviews } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare, Calendar, User } from "lucide-react";

const Reviews = () => {
  const { t } = useTranslation();
  const { summary, reviews, isLoading, isError } = useReviews();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Error loading reviews. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("reviews.title")}</h1>
          <p className="text-muted-foreground">{t("reviews.description")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("reviews.average")}</CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">{t("reviews.stars_count")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("reviews.total")}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRatings}</div>
            <p className="text-xs text-muted-foreground">{t("reviews.life_time")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t("reviews.recent")}</h2>

        {reviews.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground">No reviews yet.</div>
        ) : (
          <div className="grid gap-4">
            {reviews.map((review: any) => (
              <Card key={review.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold text-sm">#{review.orderId.slice(0, 8)}</span>
                    </div>

                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(review.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-foreground">
                    {review.comment || <span className="italic text-muted-foreground">No comment provided</span>}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{review.customerName || "Customer"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviews;
