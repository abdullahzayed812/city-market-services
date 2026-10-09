import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { deliveryService } from "@/services/api/delivery.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const Stars: React.FC<{ value: number | null | undefined; size?: number }> = ({ value, size = 14 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={value != null ? `${value} / 5` : "—"}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} className={value != null && n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} />
    ))}
  </span>
);

// Customer ratings of this office's deliveries. Each rating counts for the courier
// who delivered and for the office.
const Ratings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [courier, setCourier] = useState<{ id: string; name: string } | null>(null);

  const { data: couriers = [] } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => deliveryService.getAllCouriers(),
  });
  const rated = useMemo(
    () => [...(couriers ?? [])].sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0)),
    [couriers],
  );

  const { data: result, isLoading } = useQuery({
    queryKey: ["deliveryRatings", courier?.id ?? "office"],
    queryFn: () => deliveryService.getDeliveryRatings({ courierId: courier?.id, limit: 50 }),
  });
  const summary = result?.summary;
  const total = summary?.totalRatings ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("ratings.title")}</h1>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{courier ? `${t("ratings.summary_for")} ${courier.name}` : t("ratings.office_rating")}</CardTitle>
          {courier && (
            <Button variant="ghost" size="sm" onClick={() => setCourier(null)}>
              <X size={14} className="me-1" />
              {t("ratings.whole_office")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-8">
          <div>
            <div className="text-4xl font-bold">{summary?.averageRating != null ? summary.averageRating.toFixed(1) : "—"}</div>
            <Stars value={summary?.averageRating} size={16} />
            <div className="text-xs text-muted-foreground mt-1">{t("ratings.count", { count: total })}</div>
          </div>
          <div className="flex-1 min-w-[220px] space-y-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const n = summary?.distribution?.[s] ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{s}</span>
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 bg-muted rounded">
                    <div className="h-2 bg-amber-400 rounded" style={{ width: total ? `${(n / total) * 100}%` : 0 }} />
                  </div>
                  <span className="w-8 text-end text-muted-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("ratings.couriers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {rated.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setCourier({ id: c.id, name: c.fullName })}>
                    <TableCell className="font-medium">{c.fullName}</TableCell>
                    <TableCell className="text-end">
                      {c.ratingCount ? (
                        <span className="inline-flex items-center gap-2">
                          <Stars value={c.rating} />
                          <span className="font-semibold">{c.rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({c.ratingCount})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("ratings.latest_reviews")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-6 text-center">{t("common.loading")}</div>
            ) : !result?.items.length ? (
              <p className="text-sm text-muted-foreground">{t("ratings.no_reviews")}</p>
            ) : (
              <ul className="divide-y">
                {result.items.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.courierName ?? "—"}</span>
                      <Stars value={r.stars} />
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      #{r.customerOrderId.slice(-6)} ·{" "}
                      {new Date(r.createdAt).toLocaleString(i18n.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Ratings;
