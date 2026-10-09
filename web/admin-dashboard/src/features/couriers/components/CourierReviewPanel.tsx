import React from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Bike, Building2, CalendarDays, FileText, Star, CheckCircle2, Ban, PowerOff, XCircle } from "lucide-react";
import { DocumentImage } from "@/components/DocumentImage";
import { adminApi, type CourierDetails } from "@/services/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const APPROVAL_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING_REVIEW: "outline",
  SUSPENDED: "destructive",
  REJECTED: "destructive",
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-lg font-bold">{value}</div>
  </div>
);

interface Props {
  details: CourierDetails;
  email?: string;
  // Called after approve / suspend / deactivate so the caller can refetch
  onChanged?: () => void;
}

// Everything needed to review a courier: identity documents, profile, delivery record,
// and the approve / suspend / deactivate actions.
export const CourierReviewPanel: React.FC<Props> = ({ details, email, onChanged }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { courier, office, stats } = details;
  const isFreelance = courier.courierType === "FREELANCE";

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["adminCouriers"] });
    onChanged?.();
    toast({ description: t("couriers.status_updated") });
  };
  const fail = (error: any) => toast({ variant: "destructive", description: error.response?.data?.message || t("common.error") });

  const approval = useMutation({
    mutationFn: (status: "APPROVED" | "SUSPENDED" | "REJECTED") => adminApi.setCourierApproval(courier.id, status),
    onSuccess: done,
    onError: fail,
  });
  const deactivate = useMutation({ mutationFn: () => adminApi.deactivateCourier(courier.id), onSuccess: done, onError: fail });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold me-2">{courier.fullName}</h3>
        <Badge variant="secondary">{isFreelance ? t("couriers.type_freelance") : t("couriers.type_office")}</Badge>
        {courier.approvalStatus && (
          <Badge variant={APPROVAL_BADGE[courier.approvalStatus] ?? "outline"}>{t(`couriers.approval_${courier.approvalStatus.toLowerCase()}`)}</Badge>
        )}
        <Badge variant={courier.isActive ? "default" : "secondary"}>{courier.isActive ? t("common.active") : t("common.inactive")}</Badge>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <a href={`tel:${courier.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-600">
          <Phone size={14} /> {courier.phone}
        </a>
        {email && <div className="text-slate-700 truncate">{email}</div>}
        <div className="flex items-center gap-2 text-slate-700">
          <Bike size={14} /> {courier.vehicleType || "—"} {courier.licensePlate ? `· ${courier.licensePlate}` : ""}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Building2 size={14} /> {office ? office.name : t("couriers.type_freelance")}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <CalendarDays size={14} /> {t("courier_review.joined")} {new Date(courier.createdAt).toLocaleDateString(i18n.language)}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Star size={14} className="text-amber-500" />
          {courier.ratingCount ? `${Number(courier.rating).toFixed(1)} (${courier.ratingCount})` : t("ratings.no_reviews")}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 font-semibold mb-2">
          <FileText size={16} /> {t("couriers.documents")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DocumentImage label={t("couriers.national_id")} url={courier.nationalIdUrl} />
          <DocumentImage label={t("couriers.license")} url={courier.licenseUrl} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label={t("courier_review.active")} value={stats.active} />
        <Stat label={t("courier_review.delivered")} value={stats.delivered} />
        <Stat label={t("courier_review.failed")} value={stats.failed} />
        <Stat label={t("courier_review.cancellations")} value={stats.cancellations} />
        <Stat label={t("financial.cash_collected")} value={`EGP ${stats.unsettledCash.toLocaleString()}`} />
      </div>

      <div className="flex flex-wrap gap-2 justify-end border-t pt-4">
        {courier.approvalStatus !== "APPROVED" && (
          <Button size="sm" onClick={() => approval.mutate("APPROVED")} disabled={approval.isPending}>
            <CheckCircle2 size={14} className="me-2" />
            {t("couriers.approve")}
          </Button>
        )}
        {courier.approvalStatus === "PENDING_REVIEW" && (
          <Button size="sm" variant="outline" onClick={() => approval.mutate("REJECTED")} disabled={approval.isPending}>
            <XCircle size={14} className="me-2 text-destructive" />
            {t("couriers.reject")}
          </Button>
        )}
        {courier.approvalStatus === "APPROVED" && (
          <Button size="sm" variant="outline" onClick={() => approval.mutate("SUSPENDED")} disabled={approval.isPending}>
            <Ban size={14} className="me-2 text-amber-600" />
            {t("couriers.suspend")}
          </Button>
        )}
        {courier.isActive && (
          <Button size="sm" variant="outline" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
            <PowerOff size={14} className="me-2 text-destructive" />
            {t("common.deactivate")}
          </Button>
        )}
      </div>
    </div>
  );
};
