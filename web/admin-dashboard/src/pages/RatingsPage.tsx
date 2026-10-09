import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Star, MessageSquare, X } from "lucide-react";
import { adminApi, type DeliveryRatingItem } from "@/services/api/admin-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListToolbar } from "@/components/ListToolbar";
import { Pagination } from "@/components/ui/pagination";
import { useClientPagination } from "@/hooks/useClientPagination";

const PAGE_SIZE = 20;

const Stars: React.FC<{ value: number | null | undefined; size?: number }> = ({ value, size = 14 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={value != null ? `${value} / 5` : "—"}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} className={value != null && n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
    ))}
  </span>
);

const RatingCell: React.FC<{ value: number | null | undefined; count: number | undefined }> = ({ value, count }) =>
  count ? (
    <div className="flex items-center gap-2">
      <Stars value={value} />
      <span className="font-semibold">{Number(value).toFixed(1)}</span>
      <span className="text-xs text-slate-400">({count})</span>
    </div>
  ) : (
    <span className="text-slate-400">—</span>
  );

const formatDate = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Vendors ──────────────────────────────────────────────────────────────────

const VendorRatingsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: async () => (await adminApi.getVendors()).data.data ?? [],
  });
  const [search, setSearch] = useState("");
  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...vendors]
      .filter((v) => !q || v.shopName?.toLowerCase().includes(q))
      .sort((a, b) => (b.totalRatings ?? 0) - (a.totalRatings ?? 0) || (b.averageRating ?? 0) - (a.averageRating ?? 0));
  }, [vendors, search]);
  const { page, setPage, totalPages, pageItems } = useClientPagination(sorted, PAGE_SIZE, search);

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["vendorReviews", selected?.id],
    queryFn: async () => (await adminApi.getVendorRatings(selected!.id, { limit: 50 })).data.data ?? [],
    enabled: !!selected,
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <>
      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder={t("list.search_vendors")} total={sorted.length} />
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ratings.vendor")}</TableHead>
              <TableHead>{t("ratings.rating")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.shopName}</TableCell>
                <TableCell>
                  <RatingCell value={v.averageRating} count={v.totalRatings} />
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="sm" disabled={!v.totalRatings} onClick={() => setSelected({ id: v.id, name: v.shopName })}>
                    <MessageSquare size={14} className="me-2" />
                    {t("ratings.reviews")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="py-4" />
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("ratings.reviews")}: {selected?.name}
            </DialogTitle>
          </DialogHeader>
          {reviewsLoading ? (
            <div className="p-6 text-center">{t("common.loading")}</div>
          ) : reviews.length === 0 ? (
            <div className="p-6 text-center text-slate-500">{t("ratings.no_reviews")}</div>
          ) : (
            <ul className="divide-y">
              {reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.customerName || t("ratings.anonymous")}</span>
                    <Stars value={r.stars} />
                  </div>
                  {r.comment && <p className="text-sm text-slate-600 mt-1">{r.comment}</p>}
                  <p className="text-xs text-slate-400 mt-1">{formatDate(r.createdAt, i18n.language)}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── Deliveries (couriers + offices) ──────────────────────────────────────────

type DeliveryFilter = { kind: "office" | "courier"; id: string; name: string } | null;

const DeliveryRatingsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<DeliveryFilter>(null);

  const { data: offices = [] } = useQuery({
    queryKey: ["deliveryOffices"],
    queryFn: async () => (await adminApi.getDeliveryOffices()).data.data ?? [],
  });
  const { data: couriers = [] } = useQuery({
    queryKey: ["adminCouriers", "ALL"],
    queryFn: async () => (await adminApi.getCouriers()).data.data ?? [],
  });
  const ratedCouriers = useMemo(
    () => [...couriers].filter((c: any) => c.ratingCount).sort((a: any, b: any) => b.ratingCount - a.ratingCount),
    [couriers],
  );

  const params = filter ? (filter.kind === "office" ? { deliveryOfficeId: filter.id } : { courierId: filter.id }) : {};
  // Reviews are paged on the server (it returns hasNextPage, no total)
  const [reviewsPage, setReviewsPage] = useState(1);
  React.useEffect(() => setReviewsPage(1), [filter]);
  const { data: result, isLoading } = useQuery({
    queryKey: ["deliveryRatings", params, reviewsPage],
    queryFn: async () => (await adminApi.getDeliveryRatings({ ...params, page: reviewsPage, limit: PAGE_SIZE })).data.data,
    placeholderData: (previous) => previous,
  });
  const summary = result?.summary;
  const total = summary?.totalRatings ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary for the current filter */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{filter ? `${t("ratings.summary_for")} ${filter.name}` : t("ratings.all_deliveries")}</CardTitle>
          {filter && (
            <Button variant="ghost" size="sm" onClick={() => setFilter(null)}>
              <X size={14} className="me-1" />
              {t("ratings.clear_filter")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-8">
          <div>
            <div className="text-4xl font-bold">{summary?.averageRating != null ? summary.averageRating.toFixed(1) : "—"}</div>
            <Stars value={summary?.averageRating} size={16} />
            <div className="text-xs text-slate-500 mt-1">{t("ratings.count", { count: total })}</div>
          </div>
          <div className="flex-1 min-w-[220px] space-y-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const n = summary?.distribution?.[s] ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{s}</span>
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 bg-slate-100 rounded">
                    <div className="h-2 bg-amber-400 rounded" style={{ width: total ? `${(n / total) * 100}%` : 0 }} />
                  </div>
                  <span className="w-8 text-end text-slate-500">{n}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("ratings.offices")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {offices.map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setFilter({ kind: "office", id: o.id, name: o.name })}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>
                      <RatingCell value={o.rating} count={o.ratingCount} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("ratings.couriers")}</CardTitle>
          </CardHeader>
          <CardContent>
            {ratedCouriers.length === 0 ? (
              <p className="text-sm text-slate-500">{t("ratings.no_reviews")}</p>
            ) : (
              <Table>
                <TableBody>
                  {ratedCouriers.map((c: any) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setFilter({ kind: "courier", id: c.id, name: c.fullName })}>
                      <TableCell className="font-medium">
                        {c.fullName}
                        {c.courierType === "FREELANCE" && (
                          <Badge variant="secondary" className="ms-2">
                            {t("couriers.type_freelance")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <RatingCell value={c.rating} count={c.ratingCount} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("ratings.latest_reviews")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-6 text-center">{t("common.loading")}</div>
          ) : !result?.items.length ? (
            <p className="text-sm text-slate-500">{t("ratings.no_reviews")}</p>
          ) : (
            <ul className="divide-y">
              {result.items.map((r: DeliveryRatingItem) => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {r.courierName ?? "—"}
                      <span className="text-slate-400 font-normal"> · {r.officeName ?? t("couriers.type_freelance")}</span>
                    </span>
                    <Stars value={r.stars} />
                  </div>
                  {r.comment && <p className="text-sm text-slate-600 mt-1">{r.comment}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    #{r.customerOrderId.slice(-6)} · {formatDate(r.createdAt, i18n.language)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {(reviewsPage > 1 || result?.hasNextPage) && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button variant="outline" size="sm" disabled={reviewsPage === 1} onClick={() => setReviewsPage((p) => p - 1)}>
                {t("list.previous")}
              </Button>
              <span className="text-sm text-slate-500">{reviewsPage}</span>
              <Button variant="outline" size="sm" disabled={!result?.hasNextPage} onClick={() => setReviewsPage((p) => p + 1)}>
                {t("list.next")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const RatingsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">{t("ratings.title")}</h2>
      <Tabs defaultValue="vendors">
        <TabsList>
          <TabsTrigger value="vendors">{t("ratings.tab_vendors")}</TabsTrigger>
          <TabsTrigger value="deliveries">{t("ratings.tab_deliveries")}</TabsTrigger>
        </TabsList>
        <TabsContent value="vendors" className="mt-4">
          <VendorRatingsTab />
        </TabsContent>
        <TabsContent value="deliveries" className="mt-4">
          <DeliveryRatingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RatingsPage;
