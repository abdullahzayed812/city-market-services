import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2, FileText, Loader2, LocateFixed, MapPin, Upload, X } from "lucide-react";
import { VendorType } from "@city-market/shared";
import type { Vendor } from "@city-market/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vendorService, type StoreApplication } from "@/services/api/vendor.service";

// Same limits as media-service (jpeg / png / webp, 10 MB)
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PHONE_RE = /^\+?[0-9]{10,15}$/;

type DocKey = "ownerNationalId" | "commercialRegister" | "taxCard";
const DOCS: { key: DocKey; urlField: "ownerNationalIdUrl" | "commercialRegisterUrl" | "taxCardUrl"; required: boolean }[] = [
  { key: "ownerNationalId", urlField: "ownerNationalIdUrl", required: true },
  { key: "commercialRegister", urlField: "commercialRegisterUrl", required: true },
  { key: "taxCard", urlField: "taxCardUrl", required: false },
];

const STEPS = ["store", "location", "documents", "review"] as const;
type Step = (typeof STEPS)[number];

interface Fields {
  shopName: string;
  type: string;
  shopDescription: string;
  ownerName: string;
  phone: string;
  address: string;
  latitude: string;
  longitude: string;
}

const cleanPhone = (p: string) => p.replace(/[\s-]/g, "");

// A picked document: a new file to upload, or the URL already on the application
interface DocValue {
  file: File | null;
  existingUrl: string | null;
}

interface Props {
  // Set when correcting an application (pending or rejected); fields and documents prefill
  existing?: Vendor | null;
  onSubmitted: () => void;
}

// Multi-step merchant application: store, location, documents, review. Nothing is sent
// until the last step; documents upload first, then the application, and the merchant
// only sees a confirmation once vendor-service has accepted it.
export function StoreApplicationForm({ existing, onSubmitted }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("store");
  const [fields, setFields] = useState<Fields>({
    shopName: existing?.shopName ?? "",
    type: existing?.type ?? "",
    shopDescription: existing?.shopDescription ?? "",
    ownerName: existing?.ownerName ?? "",
    phone: existing?.phone ?? "",
    address: existing?.address ?? "",
    latitude: existing?.latitude != null ? String(existing.latitude) : "",
    longitude: existing?.longitude != null ? String(existing.longitude) : "",
  });
  const [docs, setDocs] = useState<Record<DocKey, DocValue>>({
    ownerNationalId: { file: null, existingUrl: existing?.ownerNationalIdUrl ?? null },
    commercialRegister: { file: null, existingUrl: existing?.commercialRegisterUrl ?? null },
    taxCard: { file: null, existingUrl: existing?.taxCardUrl ?? null },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: "" }));
  };

  const validate = (s: Step): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === "store") {
      if (!fields.shopName.trim()) e.shopName = t("onboarding.errors.required");
      if (!fields.type) e.type = t("onboarding.errors.choose_category");
      if (!fields.ownerName.trim()) e.ownerName = t("onboarding.errors.required");
      if (!PHONE_RE.test(cleanPhone(fields.phone))) e.phone = t("onboarding.errors.invalid_phone");
    }
    if (s === "location") {
      if (!fields.address.trim()) e.address = t("onboarding.errors.required");
      const lat = Number(fields.latitude);
      const lng = Number(fields.longitude);
      if (!fields.latitude || !fields.longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        e.location = t("onboarding.errors.location_required");
      }
    }
    if (s === "documents") {
      for (const d of DOCS) {
        if (d.required && !docs[d.key].file && !docs[d.key].existingUrl) e[d.key] = t("onboarding.errors.document_required");
      }
    }
    return e;
  };

  const goNext = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep(STEPS[STEPS.indexOf(step) + 1]);
  };

  const pickFile = (key: DocKey, file: File | null) => {
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, [key]: t("onboarding.errors.file_type") }));
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setErrors((e) => ({ ...e, [key]: t("onboarding.errors.file_size") }));
      return;
    }
    setErrors((e) => ({ ...e, [key]: "" }));
    setDocs((d) => ({ ...d, [key]: { ...d[key], file } }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrors((e) => ({ ...e, location: t("onboarding.errors.geolocation_unavailable") }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFields((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setErrors((e) => ({ ...e, location: "" }));
        setLocating(false);
      },
      () => {
        setErrors((e) => ({ ...e, location: t("onboarding.errors.geolocation_denied") }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const submit = async () => {
    // Re-check everything: the merchant may have jumped back and changed a step
    for (const s of STEPS.slice(0, 3)) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(s);
        return;
      }
    }
    setSubmitError(null);
    try {
      const urls: Partial<Record<DocKey, string | null>> = {};
      for (const d of DOCS) {
        const value = docs[d.key];
        if (value.file) {
          setProgress(t("onboarding.uploading_document", { name: t(`onboarding.documents.${d.key}`), percent: 0 }));
          urls[d.key] = await vendorService.uploadDocument(value.file, (percent) =>
            setProgress(t("onboarding.uploading_document", { name: t(`onboarding.documents.${d.key}`), percent })),
          );
          // Keep the uploaded URL so a retry doesn't upload the same file again
          setDocs((all) => ({ ...all, [d.key]: { file: null, existingUrl: urls[d.key]! } }));
        } else {
          urls[d.key] = value.existingUrl;
        }
      }
      setProgress(t("onboarding.submitting"));
      const application: StoreApplication = {
        shopName: fields.shopName.trim(),
        type: fields.type,
        shopDescription: fields.shopDescription.trim() || undefined,
        ownerName: fields.ownerName.trim(),
        phone: cleanPhone(fields.phone),
        address: fields.address.trim(),
        latitude: Number(fields.latitude),
        longitude: Number(fields.longitude),
        ownerNationalIdUrl: urls.ownerNationalId!,
        commercialRegisterUrl: urls.commercialRegister!,
        taxCardUrl: urls.taxCard ?? null,
      };
      if (existing) await vendorService.resubmitStore(application);
      else await vendorService.registerStore(application);
      onSubmitted();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || t("onboarding.errors.submit_failed"));
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2" aria-label={t("onboarding.steps_label")}>
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-orange-500" : "bg-slate-200"}`} />
            <div className={`mt-1.5 text-xs ${i === stepIndex ? "text-orange-700 font-semibold" : "text-slate-400"}`}>{t(`onboarding.step.${s}`)}</div>
          </li>
        ))}
      </ol>

      {step === "store" && (
        <div className="space-y-4">
          <Field id="shopName" label={t("onboarding.shop_name")} error={errors.shopName} required>
            <Input id="shopName" value={fields.shopName} onChange={set("shopName")} maxLength={255} />
          </Field>
          <Field id="type" label={t("onboarding.category")} error={errors.type} required>
            <select
              id="type"
              value={fields.type}
              onChange={set("type")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t("onboarding.choose_category")}</option>
              {Object.values(VendorType).map((v) => (
                <option key={v} value={v}>
                  {t(`vendor_types.${v}`, v)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ownerName" label={t("onboarding.owner_name")} hint={t("onboarding.owner_name_hint")} error={errors.ownerName} required>
            <Input id="ownerName" value={fields.ownerName} onChange={set("ownerName")} maxLength={255} />
          </Field>
          <Field id="phone" label={t("onboarding.phone")} hint={t("onboarding.phone_hint")} error={errors.phone} required>
            <Input id="phone" type="tel" dir="ltr" value={fields.phone} onChange={set("phone")} placeholder="01xxxxxxxxx" />
          </Field>
          <Field id="shopDescription" label={t("onboarding.description")} optional>
            <textarea
              id="shopDescription"
              value={fields.shopDescription}
              onChange={set("shopDescription")}
              rows={3}
              maxLength={1000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>
      )}

      {step === "location" && (
        <div className="space-y-4">
          <Field id="address" label={t("onboarding.address")} hint={t("onboarding.address_hint")} error={errors.address} required>
            <Input id="address" value={fields.address} onChange={set("address")} />
          </Field>
          <div className="space-y-2">
            <Label>
              {t("onboarding.map_location")} <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">{t("onboarding.map_location_hint")}</p>
            <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating} className="gap-2">
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              {t("onboarding.use_current_location")}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Input aria-label={t("onboarding.latitude")} placeholder={t("onboarding.latitude")} dir="ltr" inputMode="decimal" value={fields.latitude} onChange={set("latitude")} />
              <Input aria-label={t("onboarding.longitude")} placeholder={t("onboarding.longitude")} dir="ltr" inputMode="decimal" value={fields.longitude} onChange={set("longitude")} />
            </div>
            {fields.latitude && fields.longitude && !errors.location && (
              <a
                className="inline-flex items-center gap-1 text-xs text-orange-700 hover:underline"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${fields.latitude},${fields.longitude}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin className="w-3 h-3" /> {t("onboarding.check_on_map")}
              </a>
            )}
            {errors.location && <p className="text-xs text-red-600">{errors.location}</p>}
          </div>
        </div>
      )}

      {step === "documents" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("onboarding.documents_intro")}</p>
          {DOCS.map((d) => (
            <DocumentField
              key={d.key}
              id={d.key}
              label={t(`onboarding.documents.${d.key}`)}
              required={d.required}
              value={docs[d.key]}
              error={errors[d.key]}
              onPick={(file) => pickFile(d.key, file)}
            />
          ))}
          <p className="text-xs text-muted-foreground">{t("onboarding.documents_privacy")}</p>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Summary label={t("onboarding.shop_name")} value={fields.shopName} />
            <Summary label={t("onboarding.category")} value={t(`vendor_types.${fields.type}`, fields.type)} />
            <Summary label={t("onboarding.owner_name")} value={fields.ownerName} />
            <Summary label={t("onboarding.phone")} value={cleanPhone(fields.phone)} ltr />
            <Summary label={t("onboarding.address")} value={fields.address} wide />
            <Summary label={t("onboarding.documents_title")} value={DOCS.filter((d) => docs[d.key].file || docs[d.key].existingUrl).map((d) => t(`onboarding.documents.${d.key}`)).join(" · ")} wide />
          </dl>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t("onboarding.review_notice")}</div>
          {submitError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" disabled={stepIndex === 0 || busy} onClick={() => setStep(STEPS[stepIndex - 1])}>
          {t("onboarding.back")}
        </Button>
        {step !== "review" ? (
          <Button type="button" onClick={goNext} className="bg-orange-600 hover:bg-orange-700">
            {t("onboarding.next")}
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={busy} className="bg-orange-600 hover:bg-orange-700 gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {progress ?? (submitError ? t("onboarding.retry") : existing ? t("onboarding.resubmit") : t("onboarding.submit"))}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, hint, error, required, optional, children }: { id: string; label: string; hint?: string; error?: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-xs font-normal text-muted-foreground">({t("onboarding.optional")})</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Summary({ label, value, wide, ltr }: { label: string; value: string; wide?: boolean; ltr?: boolean }) {
  return (
    <div className={`rounded-md bg-slate-50 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800 break-words" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </dd>
    </div>
  );
}

// Document picker with a preview of the new file, or of the one already submitted
function DocumentField({ id, label, required, value, error, onPick }: { id: string; label: string; required: boolean; value: DocValue; error?: string; onPick: (file: File | null) => void }) {
  const { t } = useTranslation();
  const previewUrl = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);
  const shown = previewUrl ?? value.existingUrl;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required ? <span className="text-red-500">*</span> : <span className="text-xs font-normal text-muted-foreground">({t("onboarding.optional")})</span>}
      </Label>
      <label
        htmlFor={id}
        className={`flex items-center gap-3 rounded-md border border-dashed p-3 cursor-pointer hover:bg-muted/50 ${error ? "border-red-400" : shown ? "border-emerald-400" : ""}`}
      >
        {shown ? <img src={shown} alt={label} className="h-14 w-20 rounded object-cover border" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate flex items-center gap-1">
            {shown ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Upload className="w-4 h-4 text-muted-foreground shrink-0" />}
            {value.file ? value.file.name : shown ? t("onboarding.document_on_file") : t("onboarding.choose_photo")}
          </div>
          <div className="text-xs text-muted-foreground">{shown ? t("onboarding.tap_to_replace") : t("onboarding.file_rules")}</div>
        </div>
        {value.file && (
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-700"
            aria-label={t("common.cancel")}
            onClick={(e) => {
              e.preventDefault();
              onPick(null);
            }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
      <input id={id} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

