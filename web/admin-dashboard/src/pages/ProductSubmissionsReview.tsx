import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Eye, ImageOff } from "lucide-react";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListToolbar } from "@/components/ListToolbar";
import { Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SubmissionReviewPanel, SUBMISSION_STATUS_BADGE, useSubmissionErrorText } from "@/features/product-submissions/components/SubmissionReviewPanel";

const PAGE_SIZE = 20;
const FILTERS = ["PENDING_REVIEW", "NEEDS_CHANGES", "APPROVED", "REJECTED", "CANCELLED", "ALL"] as const;
type Filter = (typeof FILTERS)[number];

// Review queue of merchants' new-product proposals (pending first by default)
const ProductSubmissionsReview: React.FC = () => {
  const { t, i18n } = useTranslation();
  const errorText = useSubmissionErrorText();
  const [filter, setFilter] = useState<Filter>("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  React.useEffect(() => setPage(1), [filter, debouncedSearch]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["productSubmissions", filter, debouncedSearch, page],
    queryFn: async () =>
      (
        await adminApi.getProductSubmissions({
          status: filter === "ALL" ? undefined : filter,
          search: debouncedSearch || undefined,
          page,
          limit: PAGE_SIZE,
        })
      ).data.data!,
    placeholderData: (previous) => previous,
  });
  const rows = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t("product_submissions.title")}</h2>
        <p className="text-sm text-slate-500">{t("product_submissions.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
            {key === "ALL" ? t("couriers.filter_all") : t(`product_submissions.status.${key}`)}
          </Button>
        ))}
      </div>

      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder={t("product_submissions.search_placeholder")} total={data?.total} />

      {isLoading ? (
        <div className="p-8 text-center">{t("common.loading")}</div>
      ) : error ? (
        <div className="p-8 text-center text-red-600">{errorText(error)}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[72px]">{t("common.image")}</TableHead>
                <TableHead>{t("common.product")}</TableHead>
                <TableHead>{t("common.category")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("product_submissions.submitted_at")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt="" className="h-12 w-12 rounded object-cover bg-slate-100" loading="lazy" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-slate-400">
                        <ImageOff size={16} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    {s.revision > 1 && <div className="text-xs text-slate-500">{t("product_submissions.revision", { n: s.revision })}</div>}
                  </TableCell>
                  <TableCell>{s.globalCategoryName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={SUBMISSION_STATUS_BADGE[s.status] ?? "outline"}>{t(`product_submissions.status.${s.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{new Date(s.submittedAt).toLocaleString(i18n.language)}</TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm" onClick={() => setViewId(s.id)}>
                      <Eye size={14} className="me-2" />
                      {s.status === "PENDING_REVIEW" ? t("product_submissions.review") : t("user_details.view")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && <div className="p-8 text-center text-slate-500">{t("product_submissions.empty")}</div>}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="py-4" />
        </div>
      )}

      <Dialog open={!!viewId} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>{t("product_submissions.review_title")}</DialogTitle>
          </DialogHeader>
          {viewId && <SubmissionReviewPanel id={viewId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductSubmissionsReview;
