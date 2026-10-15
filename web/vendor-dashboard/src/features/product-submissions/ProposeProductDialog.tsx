import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, PackageCheck, PackagePlus, ArrowLeft, ArrowRight, CheckCircle2, Ban } from "lucide-react";
import { MeasurementType, WeightUnit, type ProductDuplicateMatch, type ProductSubmission, type ProductSubmissionInput } from "@city-market/shared";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productService } from "@/services/api/product.service";
import { productSubmissionService } from "@/services/api/product-submission.service";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SubmissionImagePicker, type PickedSubmissionImage } from "./SubmissionImagePicker";
import { AddExistingProductForm } from "./AddExistingProductForm";
import { useSubmissionErrorText } from "./useSubmissionErrorText";

type Step = "search" | "form" | "review" | "done";

interface FormState {
  name: string;
  description: string;
  globalCategoryId: string;
  measurementType: MeasurementType;
  weightUnit: WeightUnit;
}

const isStrong = (m: ProductDuplicateMatch) => m.exact || (m.sameCategory && m.score >= 0.75);

const MatchItem: React.FC<{ match: ProductDuplicateMatch; action?: React.ReactNode; children?: React.ReactNode }> = ({ match, action, children }) => {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border p-2">
      {match.imageUrl ? (
        <img src={match.imageUrl} alt="" className="h-12 w-12 rounded object-cover bg-muted" loading="lazy" />
      ) : (
        <div className="h-12 w-12 rounded bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{match.name}</div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {match.globalCategoryName && <span>{match.globalCategoryName}</span>}
          {match.exact && <Badge variant="destructive">{t("product_submissions.same_name")}</Badge>}
          {match.sameCategory && <Badge variant="secondary">{t("product_submissions.same_category")}</Badge>}
        </div>
      </div>
      {action}
      {children && <div className="basis-full">{children}</div>}
    </li>
  );
};

// 1. search the catalog (add an existing product directly), 2. fill in the proposal,
// 3. review and submit. Editing an existing proposal starts at step 2.
export const ProposeProductDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ProductSubmission | null;
  onSaved?: (submission: ProductSubmission) => void;
}> = ({ open, onOpenChange, existing, onSaved }) => {
  const { t } = useTranslation();
  const errorText = useSubmissionErrorText();
  const queryClient = useQueryClient();
  const editing = !!existing;

  const [step, setStep] = useState<Step>(editing ? "form" : "search");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>({ name: "", description: "", globalCategoryId: "", measurementType: MeasurementType.UNIT, weightUnit: WeightUnit.KG });
  const [image, setImage] = useState<PickedSubmissionImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<"name" | "category" | "image", string>>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [conflictMatches, setConflictMatches] = useState<ProductDuplicateMatch[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  // The catalog product whose price / stock form is open
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(existing ? "form" : "search");
    setQuery("");
    setAcknowledged(existing?.vendorAcknowledgedDuplicates ?? false);
    setConflictMatches(null);
    setFormErrors({});
    setAdded(new Set());
    setAddingId(null);
    setForm({
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      globalCategoryId: existing?.globalCategoryId ?? "",
      measurementType: existing?.measurementType ?? MeasurementType.UNIT,
      weightUnit: existing?.weightUnit ?? WeightUnit.KG,
    });
    // The current photo of a proposal being edited: no key, so the server keeps it
    setImage(existing?.imageUrl ? { key: "", previewUrl: existing.imageUrl, width: existing.imageWidth, height: existing.imageHeight } : null);
  }, [open, existing]);

  const { data: categories = [] } = useQuery({ queryKey: ["global-categories"], queryFn: () => productService.getGlobalCategories(), enabled: open });

  const debouncedQuery = useDebouncedValue(query.trim(), 400);
  const { data: searchMatches = [], isFetching: searching } = useQuery({
    queryKey: ["submission-search", debouncedQuery],
    queryFn: () => productSubmissionService.checkDuplicates(debouncedQuery),
    enabled: open && step === "search" && debouncedQuery.length >= 2,
  });

  const { data: reviewMatches = [], isFetching: checking } = useQuery({
    queryKey: ["submission-review-matches", form.name.trim(), form.globalCategoryId],
    queryFn: () => productSubmissionService.checkDuplicates(form.name.trim(), form.globalCategoryId),
    enabled: open && step === "review" && form.name.trim().length >= 2,
  });
  const matches = conflictMatches ?? reviewMatches;
  // Same name in the same category: it's already in the catalog, the server refuses a proposal
  const alreadyInCatalog = matches.filter((m) => m.exact && m.sameCategory);
  const needsAck = alreadyInCatalog.length === 0 && matches.some(isStrong);

  const save = useMutation({
    mutationFn: () => {
      const input: ProductSubmissionInput = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        globalCategoryId: form.globalCategoryId,
        measurementType: form.measurementType,
        weightUnit: form.measurementType === MeasurementType.WEIGHT ? form.weightUnit : null,
        // Empty when editing without a new photo: the current one is kept
        imageKey: image?.key ?? "",
        acknowledgedDuplicates: acknowledged,
      };
      return existing ? productSubmissionService.update(existing.id, input) : productSubmissionService.create(input);
    },
    onSuccess: (submission) => {
      queryClient.invalidateQueries({ queryKey: ["product-submissions"] });
      queryClient.setQueryData(["product-submission", submission.id], submission);
      onSaved?.(submission);
      setStep("done");
    },
    onError: (err: any) => {
      const code = err?.response?.data?.message;
      if (code === "possible_duplicates" || code === "product_already_in_catalog") {
        setConflictMatches(err.response.data.errors?.matches ?? []);
        setAcknowledged(false);
        return;
      }
      toast.error(errorText(err));
    },
  });

  const addAction = (m: ProductDuplicateMatch, label: string) =>
    added.has(m.globalProductId) ? (
      <span className="flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="h-4 w-4" /> {t("product_submissions.in_store")}
      </span>
    ) : addingId === m.globalProductId ? null : (
      <Button size="sm" variant="outline" onClick={() => setAddingId(m.globalProductId)}>
        <PackageCheck className="me-1 h-4 w-4" /> {label}
      </Button>
    );
  const addForm = (m: ProductDuplicateMatch) =>
    addingId === m.globalProductId && !added.has(m.globalProductId) ? (
      <AddExistingProductForm
        match={m}
        onCancel={() => setAddingId(null)}
        onAdded={(id) => {
          setAdded((prev) => new Set(prev).add(id));
          setAddingId(null);
        }}
      />
    ) : null;

  const categoryName = useMemo(() => categories.find((c: any) => c.id === form.globalCategoryId)?.name, [categories, form.globalCategoryId]);

  const validate = () => {
    const errors: typeof formErrors = {};
    const name = form.name.trim();
    if (name.length < 2) errors.name = t("product_submissions.errors.submission_name_required");
    else if (name.length > 255) errors.name = t("product_submissions.errors.submission_name_too_long");
    if (!form.globalCategoryId) errors.category = t("product_submissions.errors.invalid_global_category");
    // Editing keeps the current photo unless a new one is chosen
    if (!image && !editing) errors.image = t("product_submissions.errors.submission_image_required");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const startNew = () => {
    setForm((f) => ({ ...f, name: query.trim() }));
    setStep("form");
  };

  const title = editing
    ? existing?.status === "NEEDS_CHANGES"
      ? t("product_submissions.edit_and_resubmit")
      : t("product_submissions.edit_proposal")
    : t("product_submissions.propose_title");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === "search" && t("product_submissions.step_search_hint")}
            {step === "form" && t("product_submissions.step_form_hint")}
            {step === "review" && t("product_submissions.step_review_hint")}
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("product_submissions.search_catalog")} className="ps-9" />
            </div>
            {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {debouncedQuery.length >= 2 && !searching && (
              <>
                {searchMatches.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">{t("product_submissions.found_in_catalog")}</p>
                    <ul className="space-y-2">
                      {searchMatches.map((m) => (
                        <MatchItem key={m.globalProductId} match={m} action={addAction(m, t("product_submissions.add_to_store"))}>
                          {addForm(m)}
                        </MatchItem>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("product_submissions.nothing_found")}</p>
                )}
              </>
            )}
            <div className="rounded-lg border border-dashed p-3 text-sm">
              <p className="mb-2 text-muted-foreground">{t("product_submissions.not_listed")}</p>
              <Button variant="secondary" onClick={startNew} disabled={query.trim().length < 2}>
                <PackagePlus className="me-2 h-4 w-4" /> {t("product_submissions.propose_new")}
              </Button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4">
            {existing?.status === "NEEDS_CHANGES" && existing.reviewNote && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="text-xs font-semibold">{t("product_submissions.admin_feedback")}</div>
                <p className="whitespace-pre-wrap">{existing.reviewNote}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ps-name">{t("product_submissions.name")} *</Label>
              <Input id="ps-name" value={form.name} maxLength={255} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <p className="text-xs text-muted-foreground">{t("product_submissions.name_hint")}</p>
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("product_submissions.category")} *</Label>
                <Select value={form.globalCategoryId} onValueChange={(v) => setForm({ ...form, globalCategoryId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("product_submissions.choose_category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.category && <p className="text-sm text-destructive">{formErrors.category}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("product_submissions.sold_by")} *</Label>
                <div className="flex gap-2">
                  <Select value={form.measurementType} onValueChange={(v) => setForm({ ...form, measurementType: v as MeasurementType })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MeasurementType.UNIT}>{t("products.unit")}</SelectItem>
                      <SelectItem value={MeasurementType.WEIGHT}>{t("products.weight")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.measurementType === MeasurementType.WEIGHT && (
                    <Select value={form.weightUnit} onValueChange={(v) => setForm({ ...form, weightUnit: v as WeightUnit })}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={WeightUnit.KG}>{t("product_submissions.unit_kg")}</SelectItem>
                        <SelectItem value={WeightUnit.GRAM}>{t("product_submissions.unit_gram")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-description">{t("product_submissions.description")}</Label>
              <textarea
                id="ps-description"
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("product_submissions.photo")} *</Label>
              <SubmissionImagePicker value={image} onChange={setImage} onUploadingChange={setUploading} />
              {formErrors.image && <p className="text-sm text-destructive">{formErrors.image}</p>}
            </div>
            <p className="text-xs text-muted-foreground">{t("product_submissions.price_later_hint")}</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              {image?.previewUrl && <img src={image.previewUrl} alt="" className="h-32 w-32 shrink-0 rounded-lg border object-contain" />}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("product_submissions.name")}</dt>
                <dd className="font-medium">{form.name.trim()}</dd>
                <dt className="text-muted-foreground">{t("product_submissions.category")}</dt>
                <dd>{categoryName ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("product_submissions.sold_by")}</dt>
                <dd>
                  {form.measurementType === MeasurementType.WEIGHT
                    ? `${t("products.weight")} (${t(`product_submissions.unit_${form.weightUnit.toLowerCase()}`)})`
                    : t("products.unit")}
                </dd>
                <dt className="text-muted-foreground">{t("product_submissions.description")}</dt>
                <dd className="whitespace-pre-wrap">{form.description.trim() || "—"}</dd>
              </dl>
            </div>
            {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {alreadyInCatalog.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-1 text-sm font-medium text-red-900">
                  <Ban className="h-4 w-4" /> {t("product_submissions.already_in_catalog")}
                </p>
                <ul className="space-y-2">
                  {alreadyInCatalog.map((m) => (
                    <MatchItem key={m.globalProductId} match={m} action={addAction(m, t("product_submissions.add_to_store"))}>
                      {addForm(m)}
                    </MatchItem>
                  ))}
                </ul>
              </div>
            ) : (
              matches.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-900">{t("product_submissions.similar_exist")}</p>
                  <ul className="space-y-2">
                    {matches.map((m) => (
                      <MatchItem key={m.globalProductId} match={m} action={addAction(m, t("product_submissions.use_this"))}>
                        {addForm(m)}
                      </MatchItem>
                    ))}
                  </ul>
                  {needsAck && (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                      {t("product_submissions.confirm_different")}
                    </label>
                  )}
                </div>
              )
            )}
            <p className="text-xs text-muted-foreground">{t("product_submissions.review_notice")}</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="font-semibold">{t(editing ? "product_submissions.resubmitted_title" : "product_submissions.submitted_title")}</p>
            <p className="text-sm text-muted-foreground">{t("product_submissions.submitted_body")}</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "form" && !editing && (
            <Button variant="ghost" onClick={() => setStep("search")}>
              <ArrowLeft className="me-1 h-4 w-4 rtl:rotate-180" /> {t("product_submissions.back")}
            </Button>
          )}
          {step === "form" && (
            <Button disabled={uploading} onClick={() => validate() && (setConflictMatches(null), setStep("review"))}>
              {t("product_submissions.next")} <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
            </Button>
          )}
          {step === "review" && (
            <>
              <Button variant="ghost" onClick={() => setStep("form")} disabled={save.isPending}>
                <ArrowLeft className="me-1 h-4 w-4 rtl:rotate-180" /> {t("product_submissions.back")}
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || checking || alreadyInCatalog.length > 0 || (needsAck && !acknowledged)}>
                {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t(editing ? "product_submissions.save_and_submit" : "product_submissions.submit")}
              </Button>
            </>
          )}
          {(step === "done" || step === "search") && (
            <Button variant={step === "done" ? "default" : "ghost"} onClick={() => onOpenChange(false)}>
              {t(step === "done" ? "product_submissions.close" : "common.cancel")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
