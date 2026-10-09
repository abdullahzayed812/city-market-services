import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileField } from "@/components/FileField";
import { deliveryService } from "@/services/api/delivery.service";
import { useToast } from "@/hooks/use-toast";
import { DEMO_MODE } from "@/config/demo";

const VEHICLES = ["Motorcycle", "Car", "Bicycle"] as const;
const MIN_PASSWORD = 8;

// Demo prefill so a new courier request can be sent in one click (documents still picked)
const initialForm = () =>
  DEMO_MODE
    ? {
        fullName: "مندوب تجريبي",
        phone: `010${Math.floor(10000000 + Math.random() * 89999999)}`,
        email: `courier${Date.now().toString().slice(-6)}@citymarket.com`,
        password: "password123",
        licensePlate: "أ ب ج 1234",
      }
    : { fullName: "", phone: "", email: "", password: "", licensePlate: "" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// Manager adds a courier to their office. The account is created right away but the
// courier can't work until an admin reviews the documents and approves.
export function AddCourierDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLES)[number]>("Motorcycle");
  const [nationalId, setNationalId] = useState<File | null>(null);
  const [license, setLicense] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const needsLicense = vehicleType !== "Bicycle";

  const set = (key: keyof ReturnType<typeof initialForm>) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const reset = () => {
    setForm(initialForm());
    setVehicleType("Motorcycle");
    setNationalId(null);
    setLicense(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < MIN_PASSWORD) {
      toast({ variant: "destructive", description: t("office_signup.password_too_short", { min: MIN_PASSWORD }) });
      return;
    }
    if (!nationalId || (needsLicense && !license)) {
      toast({ variant: "destructive", description: t("add_courier.documents_required") });
      return;
    }
    try {
      setProgress(t("office_signup.uploading"));
      const [nationalIdUrl, licenseUrl] = await Promise.all([
        deliveryService.uploadCourierDocument(nationalId),
        needsLicense && license ? deliveryService.uploadCourierDocument(license) : Promise.resolve(undefined),
      ]);
      setProgress(t("office_signup.submitting"));
      await deliveryService.addOfficeCourier({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        vehicleType,
        licensePlate: form.licensePlate.trim() || undefined,
        nationalIdUrl,
        licenseUrl,
      });
      toast({ description: t("add_courier.sent") });
      reset();
      onCreated();
    } catch (error: any) {
      toast({ variant: "destructive", description: error.response?.data?.message || t("office_signup.submit_failed") });
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !progress && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("add_courier.title")}</DialogTitle>
          <DialogDescription>{t("add_courier.subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">{t("common.name")}</Label>
              <Input id="c-name" value={form.fullName} onChange={set("fullName")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">{t("common.phone")}</Label>
              <Input id="c-phone" type="tel" dir="ltr" value={form.phone} onChange={set("phone")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">{t("common.email")}</Label>
              <Input id="c-email" type="email" dir="ltr" value={form.email} onChange={set("email")} required autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-password">{t("common.password")}</Label>
              <PasswordInput id="c-password" value={form.password} onChange={set("password")} required autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label>{t("common.vehicle")}</Label>
              <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as (typeof VEHICLES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`add_courier.vehicle_${v.toLowerCase()}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsLicense && (
              <div className="space-y-2">
                <Label htmlFor="c-plate">{t("add_courier.license_plate")}</Label>
                <Input id="c-plate" value={form.licensePlate} onChange={set("licensePlate")} />
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FileField id="c-national-id" label={t("add_courier.national_id")} hint={t("add_courier.pick_photo")} file={nationalId} onChange={setNationalId} />
            {needsLicense && (
              <FileField id="c-license" label={t("add_courier.license")} hint={t("add_courier.pick_photo")} file={license} onChange={setLicense} />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={!!progress} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!!progress}>
              {progress ?? t("add_courier.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
