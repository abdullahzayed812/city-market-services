import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, CalendarDays, FileText, CheckCircle2, Ban, XCircle, User, Store, History } from "lucide-react";
import type { Vendor } from "@city-market/shared";
import { adminApi } from "@/services/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentImage } from "@/components/DocumentImage";
import { useToast } from "@/hooks/use-toast";

export const VENDOR_APPROVAL_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING_REVIEW: "outline",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
};

type Decision = "APPROVED" | "REJECTED" | "SUSPENDED";

// Review a merchant application: store details, documents, history; approve, reject
// (with a reason the merchant sees) or suspend. Same layout as the office review.
export const VendorReviewPanel: React.FC<{ vendor: Vendor; onChanged?: () => void }> = ({ vendor, onChanged }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const status = vendor.approvalStatus ?? "APPROVED";

  const { data: history = [] } = useQuery({
    queryKey: ["vendorApprovalHistory", vendor.id],
    queryFn: async () => (await adminApi.getVendorApprovalHistory(vendor.id)).data.data ?? [],
  });

  const decide = useMutation({
    mutationFn: ({ decision, reason }: { decision: Decision; reason?: string }) => adminApi.setVendorApproval(vendor.id, decision, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendorApprovalHistory", vendor.id] });
      setPending(null);
      setNote("");
      onChanged?.();
      toast({ description: t("vendor_review.decision_saved") });
    },
    onError: (error: any) => toast({ variant: "destructive", description: error.response?.data?.message || t("common.error") }),
  });

  const needsReason = pending === "REJECTED" || pending === "SUSPENDED";
  const confirm = () => {
    if (!pending) return;
    if (needsReason && !note.trim()) {
      toast({ variant: "destructive", description: t("vendor_review.reason_required") });
      return;
    }
    decide.mutate({ decision: pending, reason: note.trim() || undefined });
  };

  const typeLabel = vendor.type ? t(`vendors.types.${vendor.type.toLowerCase()}`, vendor.type) : "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold me-2">{vendor.shopName}</h3>
        <Badge variant={VENDOR_APPROVAL_BADGE[status] ?? "outline"}>{t(`couriers.approval_${status.toLowerCase()}`)}</Badge>
        <Badge variant="secondary">{vendor.status}</Badge>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-slate-700">
          <User size={14} /> {vendor.ownerName || "—"}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Store size={14} /> {typeLabel}
        </div>
        {vendor.phone && (
          <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-600" dir="ltr">
            <Phone size={14} /> {vendor.phone}
          </a>
        )}
        <div className="flex items-center gap-2 text-slate-700">
          <CalendarDays size={14} />
          {t("vendor_review.submitted")} {vendor.submittedAt ? new Date(vendor.submittedAt).toLocaleString(i18n.language) : "—"}
        </div>
        <div className="flex items-start gap-2 text-slate-700 sm:col-span-2">
          <MapPin size={14} className="mt-0.5" />
          <span>
            {vendor.address || "—"}
            {vendor.latitude != null && vendor.longitude != null && (
              <a
                className="ms-2 text-indigo-600 hover:underline"
                href={`https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("vendor_review.open_map")}
              </a>
            )}
          </span>
        </div>
        {vendor.shopDescription && <p className="text-slate-600 sm:col-span-2">{vendor.shopDescription}</p>}
      </div>

      {vendor.reviewNote && status !== "APPROVED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <div className="text-xs font-semibold text-red-700">{t("vendor_review.last_reason")}</div>
          <p className="text-red-800 whitespace-pre-wrap">{vendor.reviewNote}</p>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 font-semibold mb-2">
          <FileText size={16} /> {t("couriers.documents")}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <DocumentImage label={t("vendor_review.owner_national_id")} url={vendor.ownerNationalIdUrl} />
          <DocumentImage label={t("vendor_review.commercial_register")} url={vendor.commercialRegisterUrl} />
          <DocumentImage label={t("vendor_review.tax_card")} url={vendor.taxCardUrl} />
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            <History size={16} /> {t("vendor_review.history")}
          </div>
          <ol className="space-y-1.5 text-sm max-h-40 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString(i18n.language)}</span>
                <Badge variant={VENDOR_APPROVAL_BADGE[h.approvalStatus] ?? "outline"}>{t(`couriers.approval_${h.approvalStatus.toLowerCase()}`)}</Badge>
                {h.note && <span className="text-slate-600">{h.note === "submitted" || h.note === "resubmitted" ? t(`vendor_review.${h.note}`) : h.note}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {pending && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">{t(`vendor_review.confirm_${pending.toLowerCase()}`)}</div>
          <textarea
            className="w-full rounded-md border border-slate-200 p-2 text-sm"
            rows={3}
            maxLength={1000}
            placeholder={t(needsReason ? "vendor_review.reason_placeholder" : "vendor_review.note_placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPending(null)} disabled={decide.isPending}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" variant={pending === "APPROVED" ? "default" : "destructive"} onClick={confirm} disabled={decide.isPending}>
              {t("vendor_review.confirm")}
            </Button>
          </div>
        </div>
      )}

      {!pending && (
        <div className="flex flex-wrap gap-2 justify-end border-t pt-4">
          {(status === "PENDING_REVIEW" || status === "REJECTED" || status === "SUSPENDED") && (
            <Button size="sm" onClick={() => setPending("APPROVED")}>
              <CheckCircle2 size={14} className="me-2" />
              {t("couriers.approve")}
            </Button>
          )}
          {status === "PENDING_REVIEW" && (
            <Button size="sm" variant="outline" onClick={() => setPending("REJECTED")}>
              <XCircle size={14} className="me-2 text-red-600" />
              {t("couriers.reject")}
            </Button>
          )}
          {status === "APPROVED" && (
            <Button size="sm" variant="outline" onClick={() => setPending("SUSPENDED")}>
              <Ban size={14} className="me-2 text-amber-600" />
              {t("couriers.suspend")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
