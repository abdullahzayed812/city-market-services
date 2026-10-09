import React from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, CalendarDays, FileText, Star, CheckCircle2, Ban } from "lucide-react";
import { adminApi, type OfficeDetails } from "@/services/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentImage } from "@/components/DocumentImage";
import { useToast } from "@/hooks/use-toast";

const APPROVAL_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING_REVIEW: "outline",
  SUSPENDED: "destructive",
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-lg font-bold">{value}</div>
  </div>
);

interface Props {
  details: OfficeDetails;
  email?: string;
  onChanged?: () => void;
}

// Review a delivery office: signup documents, contact, couriers and delivery record,
// and approve / suspend. Same layout as the courier review.
export const OfficeReviewPanel: React.FC<Props> = ({ details, email, onChanged }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { office, stats } = details;

  const approval = useMutation({
    mutationFn: (status: "APPROVED" | "SUSPENDED") => adminApi.setOfficeApproval(office.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOffices"] });
      onChanged?.();
      toast({ description: t("offices.status_updated") });
    },
    onError: (error: any) => toast({ variant: "destructive", description: error.response?.data?.message || t("common.error") }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold me-2">{office.name}</h3>
        <Badge variant={APPROVAL_BADGE[office.approvalStatus] ?? "outline"}>{t(`couriers.approval_${office.approvalStatus.toLowerCase()}`)}</Badge>
        {!office.isActive && <Badge variant="secondary">{t("common.inactive")}</Badge>}
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {office.phone && (
          <a href={`tel:${office.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-600">
            <Phone size={14} /> {office.phone}
          </a>
        )}
        {email && <div className="text-slate-700 truncate">{email}</div>}
        <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
          <MapPin size={14} /> {office.address || "—"}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <CalendarDays size={14} /> {t("courier_review.joined")} {new Date(office.createdAt).toLocaleDateString(i18n.language)}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Star size={14} className="text-amber-500" />
          {office.ratingCount ? `${Number(office.rating).toFixed(1)} (${office.ratingCount})` : t("ratings.no_reviews")}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 font-semibold mb-2">
          <FileText size={16} /> {t("couriers.documents")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DocumentImage label={t("offices.owner_national_id")} url={office.ownerNationalIdUrl} />
          <DocumentImage label={t("offices.commercial_register")} url={office.commercialRegisterUrl} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label={t("ratings.couriers")} value={stats.couriers} />
        <Stat label={t("offices.active_couriers")} value={stats.activeCouriers} />
        <Stat label={t("courier_review.active")} value={stats.activeDeliveries} />
        <Stat label={t("courier_review.delivered")} value={stats.delivered} />
        <Stat label={t("courier_review.failed")} value={stats.failed} />
      </div>

      <div className="flex flex-wrap gap-2 justify-end border-t pt-4">
        {office.approvalStatus !== "APPROVED" && (
          <Button size="sm" onClick={() => approval.mutate("APPROVED")} disabled={approval.isPending}>
            <CheckCircle2 size={14} className="me-2" />
            {t("couriers.approve")}
          </Button>
        )}
        {office.approvalStatus === "APPROVED" && (
          <Button size="sm" variant="outline" onClick={() => approval.mutate("SUSPENDED")} disabled={approval.isPending}>
            <Ban size={14} className="me-2 text-amber-600" />
            {t("couriers.suspend")}
          </Button>
        )}
      </div>
    </div>
  );
};
