import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, MessageSquareWarning, Link2, History, Copy, ExternalLink, Store, Search, Loader2, Eye } from "lucide-react";
import type { ProductDuplicateMatch, ProductSubmission } from "@city-market/shared";
import { adminApi } from "@/services/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export const SUBMISSION_STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING_REVIEW: "outline",
  NEEDS_CHANGES: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

type Pending = { kind: "approve" } | { kind: "changes" } | { kind: "reject" } | { kind: "link"; product: { id: string; name: string } };

// Error code from the API -> readable text (falls back to the generic error)
export const useSubmissionErrorText = () => {
  const { t } = useTranslation();
  return (error: any) => {
    const code = error?.response?.data?.message;
    return code ? t(`product_submissions.errors.${code}`, { defaultValue: t("common.error") }) : t("common.error");
  };
};

const MatchRow: React.FC<{ match: ProductDuplicateMatch; onLink?: () => void; disabled?: boolean }> = ({ match, onLink, disabled }) => {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-3 rounded-md border p-2">
      {match.imageUrl ? (
        <img src={match.imageUrl} alt="" className="h-12 w-12 rounded object-cover bg-slate-100" loading="lazy" />
      ) : (
        <div className="h-12 w-12 rounded bg-slate-100" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{match.name}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{match.globalCategoryName ?? "—"}</span>
          <span>· {t(`product_submissions.measurement_${match.measurementType.toLowerCase()}`)}</span>
          {match.exact && <Badge variant="destructive">{t("product_submissions.exact_match")}</Badge>}
          {!match.exact && <Badge variant="outline">{t("product_submissions.similarity", { percent: Math.round(match.score * 100) })}</Badge>}
          {match.sameCategory && <Badge variant="secondary">{t("product_submissions.same_category")}</Badge>}
        </div>
      </div>
      {onLink && (
        <Button size="sm" variant="outline" onClick={onLink} disabled={disabled}>
          <Link2 size={14} className="me-1.5" />
          {t("product_submissions.link_this")}
        </Button>
      )}
    </li>
  );
};

// Review one merchant proposal: fields, photo, likely duplicates, history; approve, link to an
// existing catalog product, request changes or reject.
export const SubmissionReviewPanel: React.FC<{ id: string; onChanged?: () => void }> = ({ id, onChanged }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const errorText = useSubmissionErrorText();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [duplicateConflict, setDuplicateConflict] = useState<ProductDuplicateMatch[] | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const debouncedSearch = useDebouncedValue(catalogSearch.trim());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["productSubmission", id],
    queryFn: async () => (await adminApi.getProductSubmission(id)).data.data!,
  });
  const submission = data?.submission;

  const { data: vendor } = useQuery({
    queryKey: ["adminVendor", submission?.vendorId],
    queryFn: async () => (await adminApi.getVendorById(submission!.vendorId)).data.data,
    enabled: !!submission?.vendorId,
  });

  const { data: catalogResults, isFetching: searching } = useQuery({
    queryKey: ["submissionCatalogSearch", debouncedSearch],
    queryFn: () => adminApi.getGlobalProducts(1, 8, debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const done = (submission: ProductSubmission, alreadyApplied?: boolean) => {
    queryClient.invalidateQueries({ queryKey: ["productSubmissions"] });
    queryClient.setQueryData(["productSubmission", id], (old: typeof data) => (old ? { ...old, submission } : old));
    refetch();
    setPending(null);
    setNote("");
    setDuplicateConflict(null);
    onChanged?.();
    toast({ description: t(alreadyApplied ? "product_submissions.already_applied" : "product_submissions.decision_saved") });
  };

  const decide = useMutation({
    mutationFn: async ({ action, confirmNotDuplicate }: { action: Pending; confirmNotDuplicate?: boolean }) => {
      const revision = submission!.revision;
      const text = note.trim();
      switch (action.kind) {
        case "approve":
          return (await adminApi.approveProductSubmission(id, { revision, note: text || undefined, confirmNotDuplicate })).data.data!;
        case "link":
          return (await adminApi.linkProductSubmission(id, { revision, globalProductId: action.product.id, note: text || undefined })).data.data!;
        case "changes":
          return (await adminApi.requestProductSubmissionChanges(id, { revision, feedback: text })).data.data!;
        case "reject":
          return (await adminApi.rejectProductSubmission(id, { revision, reason: text })).data.data!;
      }
    },
    onSuccess: (result) => done(result.submission, result.alreadyApplied),
    onError: (err: any) => {
      const code = err?.response?.data?.message;
      if (code === "duplicate_exists") {
        setDuplicateConflict(err.response.data.errors?.matches ?? []);
        return;
      }
      if (code === "submission_changed_reload" || code === "submission_not_reviewable") refetch();
      toast({ variant: "destructive", description: errorText(err) });
    },
  });

  if (isLoading) return <div className="p-6 text-center">{t("common.loading")}</div>;
  if (error || !submission) return <div className="p-6 text-center text-red-600">{errorText(error)}</div>;

  const status = submission.status;
  const isPending = status === "PENDING_REVIEW";
  const canReject = status === "PENDING_REVIEW" || status === "NEEDS_CHANGES";
  const needsText = pending?.kind === "changes" || pending?.kind === "reject";

  const confirm = (confirmNotDuplicate?: boolean) => {
    if (!pending) return;
    if (needsText && !note.trim()) {
      toast({ variant: "destructive", description: t("product_submissions.reason_required") });
      return;
    }
    decide.mutate({ action: pending, confirmNotDuplicate });
  };

  const start = (p: Pending) => {
    setPending(p);
    setNote("");
    setDuplicateConflict(null);
  };

  const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(i18n.language) : "—");
  const measurement =
    submission.measurementType === "WEIGHT"
      ? `${t("product_submissions.measurement_weight")} (${t(`product_submissions.unit_${(submission.weightUnit ?? "KG").toLowerCase()}`)})`
      : t("product_submissions.measurement_unit");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold me-2">{submission.name}</h3>
        <Badge variant={SUBMISSION_STATUS_BADGE[status] ?? "outline"}>{t(`product_submissions.status.${status}`)}</Badge>
        <Badge variant="secondary">{t("product_submissions.revision", { n: submission.revision })}</Badge>
        {submission.vendorAcknowledgedDuplicates && <Badge variant="outline">{t("product_submissions.vendor_confirmed_new")}</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-1">
          {submission.imageUrl ? (
            <a href={submission.imageUrl} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border bg-slate-50">
              <img src={submission.imageUrl} alt={submission.name} className="h-64 w-full object-contain" />
              <span className="absolute top-2 end-2 hidden items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs shadow group-hover:flex">
                <ExternalLink size={12} />
                {t("product_submissions.open_full")}
              </span>
            </a>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">{t("product_submissions.no_image")}</div>
          )}
          {submission.imageWidth && submission.imageHeight && (
            <div className="text-xs text-slate-500" dir="ltr">
              {submission.imageWidth} × {submission.imageHeight}px
            </div>
          )}
          {isPending && (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              <Eye size={14} className="mt-0.5 shrink-0" />
              {t("product_submissions.visual_check_hint")}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">{t("product_submissions.store")}</dt>
          <dd className="flex items-center gap-1.5">
            <Store size={14} className="text-slate-400" />
            {vendor?.shopName ?? submission.vendorId}
          </dd>
          <dt className="text-slate-500">{t("common.category")}</dt>
          <dd>{submission.globalCategoryName ?? "—"}</dd>
          <dt className="text-slate-500">{t("product_submissions.sold_by")}</dt>
          <dd>{measurement}</dd>
          <dt className="text-slate-500">{t("common.description")}</dt>
          <dd className="whitespace-pre-wrap text-slate-700">{submission.description || "—"}</dd>
          <dt className="text-slate-500">{t("product_submissions.submitted_at")}</dt>
          <dd>{fmt(submission.submittedAt)}</dd>
          {submission.reviewedAt && (
            <>
              <dt className="text-slate-500">{t("product_submissions.reviewed_at")}</dt>
              <dd>{fmt(submission.reviewedAt)}</dd>
            </>
          )}
        </dl>
      </div>

      {submission.reviewNote && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="text-xs font-semibold text-amber-800">{t("product_submissions.last_note")}</div>
          <p className="whitespace-pre-wrap text-amber-900">{submission.reviewNote}</p>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Copy size={16} /> {t("product_submissions.possible_duplicates")}
        </div>
        {data!.duplicates.length === 0 ? (
          <p className="text-sm text-slate-500">{t("product_submissions.no_duplicates")}</p>
        ) : (
          <ul className="space-y-2">
            {data!.duplicates.map((m) => (
              <MatchRow
                key={m.globalProductId}
                match={m}
                disabled={decide.isPending}
                onLink={isPending ? () => start({ kind: "link", product: { id: m.globalProductId, name: m.name } }) : undefined}
              />
            ))}
          </ul>
        )}
        {data!.similarPending.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-slate-500">{t("product_submissions.similar_pending")}</div>
            <ul className="space-y-1 text-sm">
              {data!.similarPending.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={SUBMISSION_STATUS_BADGE[s.status] ?? "outline"}>{t(`product_submissions.status.${s.status}`)}</Badge>
                  <span className="text-xs text-slate-500">{fmt(s.submittedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isPending && (
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder={t("product_submissions.search_catalog_to_link")}
                className="ps-8"
              />
            </div>
            {searching && <Loader2 size={14} className="animate-spin text-slate-400" />}
            {debouncedSearch.length >= 2 && catalogResults && (
              <ul className="space-y-2">
                {catalogResults.data.length === 0 && <li className="text-sm text-slate-500">{t("list.no_results")}</li>}
                {catalogResults.data.map((p) => (
                  <MatchRow
                    key={p.id}
                    disabled={decide.isPending}
                    match={{
                      globalProductId: p.id,
                      name: p.name,
                      imageUrl: p.imageUrl,
                      globalCategoryId: p.globalCategoryId,
                      globalCategoryName: null,
                      measurementType: p.measurementType,
                      score: 0,
                      exact: false,
                      sameCategory: p.globalCategoryId === submission.globalCategoryId,
                    }}
                    onLink={() => start({ kind: "link", product: { id: p.id, name: p.name } })}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {submission.history && submission.history.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <History size={16} /> {t("product_submissions.history")}
          </div>
          <ol className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
            {submission.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">{fmt(h.createdAt)}</span>
                <Badge variant={SUBMISSION_STATUS_BADGE[h.status] ?? "outline"}>{t(`product_submissions.action.${h.action}`)}</Badge>
                <span className="text-xs text-slate-400">{t("product_submissions.revision", { n: h.revision })}</span>
                {h.actorRole && <span className="text-xs text-slate-400">· {t(`product_submissions.actor.${h.actorRole}`, { defaultValue: h.actorRole })}</span>}
                {h.note && <span className="text-slate-700">{h.note}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {pending && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">
            {pending.kind === "link" ? t("product_submissions.confirm_link", { name: pending.product.name }) : t(`product_submissions.confirm_${pending.kind}`)}
          </div>
          <textarea
            className="w-full rounded-md border border-slate-200 p-2 text-sm"
            rows={3}
            maxLength={1000}
            placeholder={t(needsText ? "product_submissions.reason_placeholder" : "product_submissions.note_placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {duplicateConflict && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-2">
              <p className="text-sm text-red-800">{t("product_submissions.duplicate_conflict")}</p>
              <ul className="space-y-2">
                {duplicateConflict.map((m) => (
                  <MatchRow key={m.globalProductId} match={m} onLink={() => start({ kind: "link", product: { id: m.globalProductId, name: m.name } })} />
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPending(null)} disabled={decide.isPending}>
              {t("common.cancel")}
            </Button>
            {duplicateConflict ? (
              <Button size="sm" variant="destructive" onClick={() => confirm(true)} disabled={decide.isPending}>
                {decide.isPending && <Loader2 size={14} className="me-2 animate-spin" />}
                {t("product_submissions.approve_anyway")}
              </Button>
            ) : (
              <Button size="sm" variant={pending.kind === "reject" ? "destructive" : "default"} onClick={() => confirm()} disabled={decide.isPending}>
                {decide.isPending && <Loader2 size={14} className="me-2 animate-spin" />}
                {decide.isPending && pending.kind === "approve" ? t("product_submissions.publishing") : t("vendor_review.confirm")}
              </Button>
            )}
          </div>
        </div>
      )}

      {!pending && (isPending || canReject) && (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          {isPending && (
            <Button size="sm" onClick={() => start({ kind: "approve" })}>
              <CheckCircle2 size={14} className="me-2" />
              {t("product_submissions.approve")}
            </Button>
          )}
          {isPending && (
            <Button size="sm" variant="outline" onClick={() => start({ kind: "changes" })}>
              <MessageSquareWarning size={14} className="me-2 text-amber-600" />
              {t("product_submissions.request_changes")}
            </Button>
          )}
          {canReject && (
            <Button size="sm" variant="outline" onClick={() => start({ kind: "reject" })}>
              <XCircle size={14} className="me-2 text-red-600" />
              {t("product_submissions.reject")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
