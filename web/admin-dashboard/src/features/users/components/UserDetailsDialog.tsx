import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@city-market/shared";
import { adminApi } from "@/services/api/admin-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CourierReviewPanel } from "@/features/couriers/components/CourierReviewPanel";
import { OfficeReviewPanel } from "@/features/offices/components/OfficeReviewPanel";

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-end">{value ?? "—"}</span>
  </div>
);

interface Props {
  user: User | null;
  onClose: () => void;
}

// Admin view of any user: account info plus the profile that goes with their role
// (courier incl. identity documents, customer, vendor shop, delivery office).
export const UserDetailsDialog: React.FC<Props> = ({ user, onClose }) => {
  const { t, i18n } = useTranslation();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["adminUserProfile", user?.id, user?.role],
    queryFn: async () => (await adminApi.getUserProfile(user!.id, user!.role)).data.data,
    enabled: !!user,
  });
  const profile = data?.profile;
  const date = (d?: string | Date | null) => (d ? new Date(d).toLocaleString(i18n.language) : "—");

  const roleSection = () => {
    if (isLoading) return <div className="p-6 text-center">{t("common.loading")}</div>;
    if (!profile) return <p className="text-sm text-slate-500">{t("user_details.no_profile")}</p>;
    switch (user?.role) {
      case "COURIER":
        return <CourierReviewPanel details={profile} email={user.email} onChanged={() => refetch()} />;
      case "CUSTOMER":
        return (
          <div>
            <Row label={t("common.name")} value={profile.fullName} />
            <Row label={t("common.phone")} value={profile.phone && <a href={`tel:${profile.phone}`}>{profile.phone}</a>} />
            <Row
              label={t("user_details.penalty")}
              value={profile.hasPenalty ? <Badge variant="destructive">{t("user_details.has_penalty")}</Badge> : t("user_details.none")}
            />
            <Row label={t("user_details.device")} value={[profile.devicePlatform, profile.deviceModel, profile.deviceAppVersion].filter(Boolean).join(" · ") || null} />
            <Row label={t("user_details.last_device_update")} value={date(profile.deviceUpdatedAt)} />
            <Row label={t("courier_review.joined")} value={date(profile.createdAt)} />
          </div>
        );
      case "VENDOR":
        return (
          <div>
            <Row label={t("ratings.vendor")} value={profile.shopName} />
            <Row label={t("common.phone")} value={profile.phone} />
            <Row label={t("user_details.address")} value={profile.address} />
            <Row label={t("common.status")} value={<Badge variant="secondary">{profile.status}</Badge>} />
            <Row label={t("user_details.commission")} value={profile.commissionRate != null ? `${profile.commissionRate}%` : null} />
            <Row label={t("ratings.rating")} value={profile.totalRatings ? `${Number(profile.averageRating).toFixed(1)} (${profile.totalRatings})` : null} />
          </div>
        );
      case "DELIVERY_MANAGER":
        return <OfficeReviewPanel details={profile} email={user.email} onChanged={() => refetch()} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("user_details.title")}</DialogTitle>
        </DialogHeader>
        {user && (
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 p-3">
              <Row label={t("common.email")} value={user.email} />
              <Row label={t("common.role")} value={user.role} />
              <Row
                label={t("common.status")}
                value={<Badge variant={user.isActive ? "default" : "secondary"}>{user.isActive ? t("common.active") : t("common.inactive")}</Badge>}
              />
              <Row label={t("user_details.registered")} value={date(user.createdAt)} />
            </div>
            {roleSection()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
