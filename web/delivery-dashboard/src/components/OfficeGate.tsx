import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Ban, LogOut, RefreshCw } from "lucide-react";
import { EventType } from "@city-market/shared";
import { deliveryService } from "@/services/api/delivery.service";
import { useAuth } from "@/components/AuthProvider";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileField } from "@/components/FileField";

// Decides what a signed-in manager sees from their office:
//   no office yet (new signup)        -> onboarding form (details + documents)
//   office pending review / suspended -> status page
//   approved                          -> the dashboard
export default function OfficeGate({ children }: { children: React.ReactNode }) {
  const { data: office, error, isLoading, refetch } = useQuery({
    queryKey: ["myOffice"],
    queryFn: () => deliveryService.getMyOffice(),
    retry: (count, err: any) => err?.response?.status !== 404 && count < 2,
  });
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  // Admin decision arrives live; reload on approval so the socket joins the office room
  const previous = useRef(office?.approvalStatus);
  useEffect(() => {
    if (previous.current && previous.current !== "APPROVED" && office?.approvalStatus === "APPROVED") window.location.reload();
    previous.current = office?.approvalStatus;
  }, [office?.approvalStatus]);
  useEffect(() => {
    if (!socket) return;
    const onDecision = () => queryClient.invalidateQueries({ queryKey: ["myOffice"] });
    socket.on(EventType.OFFICE_APPROVAL_UPDATED, onDecision);
    return () => {
      socket.off(EventType.OFFICE_APPROVAL_UPDATED, onDecision);
    };
  }, [socket, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if ((error as any)?.response?.status === 404) return <OfficeOnboarding onDone={() => refetch()} />;
  if (office && office.approvalStatus !== "APPROVED") return <OfficeStatus status={office.approvalStatus} name={office.name} onRefresh={() => refetch()} />;
  return <>{children}</>;
}

// Step 2 of office signup: office details and documents; the office then waits for review
function OfficeOnboarding({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { logout } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ownerId, setOwnerId] = useState<File | null>(null);
  const [register, setRegister] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId || !register) {
      toast({ variant: "destructive", description: t("office_signup.documents_required") });
      return;
    }
    try {
      setProgress(t("office_signup.uploading"));
      const [ownerNationalIdUrl, commercialRegisterUrl] = await Promise.all([
        deliveryService.uploadOfficeDocument(ownerId),
        deliveryService.uploadOfficeDocument(register),
      ]);
      setProgress(t("office_signup.submitting"));
      await deliveryService.registerOffice({ name: name.trim(), phone: phone.trim(), address: address.trim(), ownerNationalIdUrl, commercialRegisterUrl });
      onDone();
    } catch (error: any) {
      toast({ variant: "destructive", description: error.response?.data?.message || t("office_signup.submit_failed") });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t("office_signup.onboarding_title")}</CardTitle>
              <CardDescription>{t("office_signup.onboarding_subtitle")}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title={t("common.logout")}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="office-name">{t("office_signup.office_name")}</Label>
              <Input id="office-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-phone">{t("office_signup.phone")}</Label>
              <Input id="office-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-address">{t("office_signup.address")}</Label>
              <Input id="office-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
            <FileField id="owner-id" label={t("office_signup.owner_national_id")} hint={t("office_signup.choose_photo")} file={ownerId} onChange={setOwnerId} />
            <FileField id="commercial-register" label={t("office_signup.commercial_register")} hint={t("office_signup.choose_photo")} file={register} onChange={setRegister} />
            <p className="text-xs text-muted-foreground">{t("office_signup.documents_privacy")}</p>
            <Button className="w-full" type="submit" disabled={progress !== null}>
              {progress ?? t("office_signup.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function OfficeStatus({ status, name, onRefresh }: { status: string; name: string; onRefresh: () => void }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const suspended = status === "SUSPENDED";
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className={`p-4 rounded-full mb-2 ${suspended ? "bg-red-100" : "bg-amber-100"}`}>
            {suspended ? <Ban className="w-8 h-8 text-red-600" /> : <Clock className="w-8 h-8 text-amber-600" />}
          </div>
          <CardTitle>{t(suspended ? "office_signup.suspended_title" : "office_signup.pending_title")}</CardTitle>
          <CardDescription>{name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(suspended ? "office_signup.suspended_body" : "office_signup.pending_body")}</p>
          {!suspended && (
            <Button className="w-full" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 me-2" />
              {t("office_signup.check_status")}
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={logout}>
            <LogOut className="w-4 h-4 me-2" />
            {t("common.logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
