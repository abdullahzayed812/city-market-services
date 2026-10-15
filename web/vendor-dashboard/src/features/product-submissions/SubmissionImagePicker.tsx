import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import type { SubmissionImageRules } from "@city-market/shared";
import { DEFAULT_IMAGE_RULES, productSubmissionService } from "@/services/api/product-submission.service";
import { useSubmissionErrorText } from "./useSubmissionErrorText";

export interface PickedSubmissionImage {
  key: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
}

const readDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("unreadable"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

// Picks a product photo, pre-checks it against the rules, and uploads it to private storage.
// The server re-checks the actual content; these checks only save a round trip.
export const SubmissionImagePicker: React.FC<{
  value: PickedSubmissionImage | null;
  onChange: (image: PickedSubmissionImage | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}> = ({ value, onChange, onUploadingChange }) => {
  const { t } = useTranslation();
  const errorText = useSubmissionErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const { data: rules = DEFAULT_IMAGE_RULES } = useQuery<SubmissionImageRules>({
    queryKey: ["submission-image-rules"],
    queryFn: () => productSubmissionService.getImageRules(),
    staleTime: 60 * 60 * 1000,
  });
  const maxMb = Math.round((rules.maxBytes / (1024 * 1024)) * 10) / 10;

  const pick = async (file: File) => {
    setError(null);
    if (!rules.mimeTypes.includes(file.type)) return setError(t("product_submissions.errors.image_format_not_allowed"));
    if (file.size > rules.maxBytes) return setError(t("product_submissions.errors.image_too_large_n", { mb: maxMb }));
    try {
      const { width, height } = await readDimensions(file);
      if (width < rules.minWidth || height < rules.minHeight) {
        return setError(t("product_submissions.errors.image_too_small_n", { w: rules.minWidth, h: rules.minHeight, actualW: width, actualH: height }));
      }
    } catch {
      return setError(t("product_submissions.errors.image_corrupted"));
    }

    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setProgress(0);
    onUploadingChange?.(true);
    try {
      const result = await productSubmissionService.uploadImage(file, setProgress);
      onChange({ key: result.key, previewUrl: preview, width: result.width, height: result.height });
    } catch (err) {
      setError(errorText(err));
      setLocalPreview(null);
      URL.revokeObjectURL(preview);
    } finally {
      setProgress(null);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const shown = localPreview ?? value?.previewUrl ?? null;
  const uploading = progress !== null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`relative flex h-56 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/30 transition hover:bg-muted/60 ${
          error ? "border-destructive" : value ? "border-green-500 border-solid" : "border-muted-foreground/30"
        }`}
      >
        {shown ? (
          <img src={shown} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <ImagePlus className="h-8 w-8" />
            {t("product_submissions.choose_photo")}
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 text-sm">
            <Loader2 className="h-6 w-6 animate-spin" />
            {t("product_submissions.uploading", { percent: progress })}
          </span>
        )}
        {value && !uploading && (
          <span className="absolute bottom-2 end-2 flex items-center gap-1 rounded bg-background/90 px-2 py-1 text-xs shadow">
            <RefreshCw className="h-3 w-3" /> {t("product_submissions.replace_photo")}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={rules.mimeTypes.join(",")}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
      />
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        <li>{t("product_submissions.rule_formats", { formats: rules.formats.map((f) => f.toUpperCase()).join(", ") })}</li>
        <li>{t("product_submissions.rule_min_size", { w: rules.minWidth, h: rules.minHeight })}</li>
        <li>{t("product_submissions.rule_max_bytes", { mb: maxMb })}</li>
        <li>{t("product_submissions.rule_content")}</li>
      </ul>
      {value && !error && value.width && value.height && (
        <p className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> {t("product_submissions.photo_ok", { w: value.width, h: value.height })}
        </p>
      )}
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </div>
  );
};
