import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock, LogOut, PencilLine, RefreshCw, XCircle } from "lucide-react";
import { EventType, VendorApprovalStatus } from "@city-market/shared";
import type { Vendor } from "@city-market/shared";
import { vendorService } from "@/services/api/vendor.service";
import { useAuth } from "@/components/AuthProvider";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StoreApplicationForm } from "@/features/onboarding/StoreApplicationForm";

// What a signed-in merchant sees, from their store's approval status:
//   no store yet (new signup)      -> store application
//   pending review                 -> status page (may still correct the application)
//   rejected                       -> admin's reason + correct and resubmit
//   suspended                      -> status page
//   approved                       -> the dashboard
// This only decides screens; vendor / catalog / order services enforce approval themselves.
export default function VendorGate({ children }: { children: React.ReactNode }) {
  const { vendor: authVendor, refreshVendor } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: vendor, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["myVendor"],
    queryFn: () => vendorService.getMyProfile(),
    // 404 just means "no store yet"; don't retry it
    retry: (count, err: any) => err?.response?.status !== 404 && count < 2,
  });

  // The admin's decision is pushed to user:<id>; refetch so the gate reacts at once
  useEffect(() => {
    if (!socket) return;
    const onDecision = () => queryClient.invalidateQueries({ queryKey: ["myVendor"] });
    socket.on(EventType.VENDOR_APPROVAL_UPDATED, onDecision);
    return () => {
      socket.off(EventType.VENDOR_APPROVAL_UPDATED, onDecision);
    };
  }, [socket, queryClient]);

  // Pages read the store from AuthProvider; keep it in step with the gate (e.g. right after approval)
  const lastStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (vendor?.approvalStatus === VendorApprovalStatus.APPROVED && (lastStatus.current !== vendor.approvalStatus || !authVendor)) {
      refreshVendor().catch(() => {});
    }
    lastStatus.current = vendor?.approvalStatus;
  }, [vendor?.approvalStatus, authVendor, refreshVendor]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  const notFound = (error as any)?.response?.status === 404;
  if (error && !notFound) return <LoadError message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />;

  const done = () => {
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["myVendor"] });
  };

  if (notFound) return <ApplicationPage onSubmitted={done} />;

  const status = vendor?.approvalStatus ?? VendorApprovalStatus.APPROVED;
  if (status === VendorApprovalStatus.APPROVED) return <>{children}</>;

  if (editing && (status === VendorApprovalStatus.PENDING_REVIEW || status === VendorApprovalStatus.REJECTED)) {
    return <ApplicationPage existing={vendor} onSubmitted={done} onCancel={() => setEditing(false)} />;
  }
  return <StatusPage vendor={vendor!} onRefresh={() => refetch()} refreshing={isFetching} onEdit={() => setEditing(true)} />;
}

function LoadError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  return (
    <Shell>
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>{t("onboarding.load_failed")}</CardTitle>
          {message && <CardDescription>{message}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 me-2" />
            {t("onboarding.retry")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={logout}>
            <LogOut className="w-4 h-4 me-2" />
            {t("common.logout")}
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-orange-50 p-4">{children}</div>;
}

function ApplicationPage({ existing, onSubmitted, onCancel }: { existing?: Vendor; onSubmitted: () => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  return (
    <Shell>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t(existing ? "onboarding.edit_title" : "onboarding.title")}</CardTitle>
              <CardDescription>{t("onboarding.subtitle")}</CardDescription>
            </div>
            <div className="flex gap-1">
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={logout} title={t("common.logout")}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StoreApplicationForm existing={existing} onSubmitted={onSubmitted} />
        </CardContent>
      </Card>
    </Shell>
  );
}

function StatusPage({ vendor, onRefresh, refreshing, onEdit }: { vendor: Vendor; onRefresh: () => void; refreshing: boolean; onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const status = vendor.approvalStatus!;
  const look = {
    [VendorApprovalStatus.PENDING_REVIEW]: { Icon: Clock, tone: "bg-amber-100 text-amber-600" },
    [VendorApprovalStatus.REJECTED]: { Icon: XCircle, tone: "bg-red-100 text-red-600" },
    [VendorApprovalStatus.SUSPENDED]: { Icon: Ban, tone: "bg-red-100 text-red-600" },
    [VendorApprovalStatus.APPROVED]: { Icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600" },
  }[status];
  const key = status.toLowerCase();
  const canEdit = status === VendorApprovalStatus.PENDING_REVIEW || status === VendorApprovalStatus.REJECTED;

  return (
    <Shell>
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className={`p-4 rounded-full mb-2 ${look.tone}`}>
            <look.Icon className="w-8 h-8" />
          </div>
          <CardTitle>{t(`onboarding.status.${key}_title`)}</CardTitle>
          <CardDescription>{vendor.shopName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(`onboarding.status.${key}_body`)}</p>
          {vendor.reviewNote && status !== VendorApprovalStatus.PENDING_REVIEW && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-start">
              <div className="text-xs font-semibold text-red-700">{t("onboarding.status.reason")}</div>
              <p className="text-sm text-red-800 whitespace-pre-wrap">{vendor.reviewNote}</p>
            </div>
          )}
          {vendor.submittedAt && (
            <p className="text-xs text-muted-foreground">
              {t("onboarding.status.submitted_at", { date: new Date(vendor.submittedAt).toLocaleString(i18n.language) })}
            </p>
          )}
          {canEdit && (
            <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={onEdit}>
              <PencilLine className="w-4 h-4 me-2" />
              {t(status === VendorApprovalStatus.REJECTED ? "onboarding.status.fix_and_resubmit" : "onboarding.status.edit_application")}
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 me-2 ${refreshing ? "animate-spin" : ""}`} />
            {t("onboarding.status.check_status")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={logout}>
            <LogOut className="w-4 h-4 me-2" />
            {t("common.logout")}
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}
