import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackagePlus, Pencil, Undo2, Tag, ImageOff, History, MessageSquareWarning, Loader2 } from "lucide-react";
import { EventType, type ProductSubmission } from "@city-market/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSocket } from "@/contexts/SocketContext";
import { productSubmissionService } from "@/services/api/product-submission.service";
import { ProposeProductDialog } from "@/features/product-submissions/ProposeProductDialog";
import { useSubmissionErrorText } from "@/features/product-submissions/useSubmissionErrorText";

const PAGE_SIZE = 20;
const FILTERS = ["ALL", "PENDING_REVIEW", "NEEDS_CHANGES", "APPROVED", "REJECTED", "CANCELLED"] as const;

export const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING_REVIEW: "outline",
  NEEDS_CHANGES: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

const isOpen = (s: ProductSubmission) => s.status === "PENDING_REVIEW" || s.status === "NEEDS_CHANGES";

const SubmissionDetail = ({ id, onEdit, onClose }: { id: string; onEdit: (s: ProductSubmission) => void; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorText = useSubmissionErrorText();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const { data: s, isLoading, error } = useQuery({ queryKey: ["product-submission", id], queryFn: () => productSubmissionService.get(id) });

  const withdraw = useMutation({
    mutationFn: () => productSubmissionService.cancel(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["product-submission", id], updated);
      queryClient.invalidateQueries({ queryKey: ["product-submissions"] });
      setConfirmWithdraw(false);
      toast.success(t("product_submissions.withdrawn"));
    },
    onError: (err) => toast.error(errorText(err)),
  });

  if (isLoading) return <div className="p-6 text-center">{t("common.loading")}</div>;
  if (error || !s) return <div className="p-6 text-center text-destructive">{errorText(error)}</div>;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language) : "—");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="me-2 text-lg font-bold">{s.name}</h3>
        <Badge variant={STATUS_BADGE[s.status]}>{t(`product_submissions.status.${s.status}`)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{t(`product_submissions.status_help.${s.status}`)}</p>

      {s.reviewNote && s.status !== "APPROVED" && (
        <div
          className={`rounded-lg border p-3 text-sm ${s.status === "REJECTED" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          <div className="flex items-center gap-1 text-xs font-semibold">
            <MessageSquareWarning className="h-3.5 w-3.5" />
            {t(s.status === "REJECTED" ? "product_submissions.rejection_reason" : "product_submissions.admin_feedback")}
          </div>
          <p className="whitespace-pre-wrap">{s.reviewNote}</p>
        </div>
      )}

      <div className="flex gap-4">
        {s.imageUrl ? (
          <img src={s.imageUrl} alt={s.name} className="h-40 w-40 shrink-0 rounded-lg border object-contain" />
        ) : (
          <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("product_submissions.category")}</dt>
          <dd>{s.globalCategoryName ?? "—"}</dd>
          <dt className="text-muted-foreground">{t("product_submissions.sold_by")}</dt>
          <dd>
            {s.measurementType === "WEIGHT"
              ? `${t("products.weight")} (${t(`product_submissions.unit_${(s.weightUnit ?? "KG").toLowerCase()}`)})`
              : t("products.unit")}
          </dd>
          <dt className="text-muted-foreground">{t("product_submissions.description")}</dt>
          <dd className="whitespace-pre-wrap">{s.description || "—"}</dd>
          <dt className="text-muted-foreground">{t("product_submissions.submitted_at")}</dt>
          <dd>{fmt(s.submittedAt)}</dd>
        </dl>
      </div>

      {s.history && s.history.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1 text-sm font-semibold">
            <History className="h-4 w-4" /> {t("product_submissions.history")}
          </div>
          <ol className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {s.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{fmt(h.createdAt)}</span>
                <span className="font-medium">{t(`product_submissions.action.${h.action}`)}</span>
                {h.note && <span className="text-muted-foreground">— {h.note}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {confirmWithdraw ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border p-3">
          <span className="me-auto text-sm">{t("product_submissions.confirm_withdraw")}</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirmWithdraw(false)} disabled={withdraw.isPending}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
            {withdraw.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("product_submissions.withdraw")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          {isOpen(s) && (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmWithdraw(true)}>
                <Undo2 className="me-1 h-4 w-4" /> {t("product_submissions.withdraw")}
              </Button>
              <Button size="sm" onClick={() => onEdit(s)}>
                <Pencil className="me-1 h-4 w-4" />{" "}
                {t(s.status === "NEEDS_CHANGES" ? "product_submissions.edit_and_resubmit" : "product_submissions.edit_proposal")}
              </Button>
            </>
          )}
          {s.status === "APPROVED" && s.vendorProductId && (
            <Button
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/products?edit=${s.vendorProductId}`);
              }}
            >
              <Tag className="me-1 h-4 w-4" /> {t("product_submissions.set_price_stock")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const ProductSubmissions = () => {
  const { t, i18n } = useTranslation();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const errorText = useSubmissionErrorText();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [page, setPage] = useState(1);
  const [proposeOpen, setProposeOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<ProductSubmission | null>(null);
  const viewId = searchParams.get("id");

  useEffect(() => setPage(1), [filter]);

  // An admin decision is pushed to this merchant: refresh the list and the open detail
  useEffect(() => {
    if (!socket) return;
    const onReviewed = (payload: { submissionId?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["product-submissions"] });
      if (payload?.submissionId) queryClient.invalidateQueries({ queryKey: ["product-submission", payload.submissionId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    };
    socket.on(EventType.PRODUCT_SUBMISSION_REVIEWED, onReviewed);
    return () => {
      socket.off(EventType.PRODUCT_SUBMISSION_REVIEWED, onReviewed);
    };
  }, [socket, queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["product-submissions", filter, page],
    queryFn: () => productSubmissionService.list({ status: filter === "ALL" ? undefined : filter, page, limit: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });
  const rows = data?.data ?? [];

  const openDetail = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("id", id);
    else next.delete("id");
    next.delete("new");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("product_submissions.title")}</h1>
          <p className="text-muted-foreground">{t("product_submissions.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setProposeOpen(true)}>
          <PackagePlus className="h-4 w-4" /> {t("product_submissions.propose_new")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
            {key === "ALL" ? t("product_submissions.filter_all") : t(`product_submissions.status.${key}`)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center">{t("common.loading")}</div>
      ) : error ? (
        <div className="p-8 text-center text-destructive">{errorText(error)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">{t("product_submissions.empty")}</div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((s) => (
            <li key={s.id}>
              <button type="button" className="flex w-full items-center gap-3 p-3 text-start hover:bg-muted/50" onClick={() => openDetail(s.id)}>
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded object-cover bg-muted" loading="lazy" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                    <ImageOff className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.globalCategoryName ?? "—"} · {new Date(s.submittedAt).toLocaleDateString(i18n.language)}
                  </div>
                  {s.status === "NEEDS_CHANGES" && s.reviewNote && <div className="truncate text-xs text-amber-700">{s.reviewNote}</div>}
                </div>
                <Badge variant={STATUS_BADGE[s.status]}>{t(`product_submissions.status.${s.status}`)}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))} onPageChange={setPage} className="pt-2" />

      <Dialog open={!!viewId} onOpenChange={(open) => !open && openDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t("product_submissions.detail_title")}</DialogTitle>
          </DialogHeader>
          {viewId && <SubmissionDetail id={viewId} onEdit={(s) => setEditing(s)} onClose={() => openDetail(null)} />}
        </DialogContent>
      </Dialog>

      <ProposeProductDialog
        open={proposeOpen || !!editing}
        existing={editing}
        onOpenChange={(open) => {
          if (open) return;
          setProposeOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
};

export default ProductSubmissions;
