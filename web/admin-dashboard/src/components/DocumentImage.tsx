import React from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

// Identity photo with a link to the full-size image
export const DocumentImage: React.FC<{ label: string; url?: string | null }> = ({ label, url }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="group block relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
          <img src={url} alt={label} className="w-full h-40 object-contain" loading="lazy" />
          <span className="absolute top-2 end-2 hidden group-hover:flex items-center gap-1 text-xs bg-white/90 px-2 py-1 rounded shadow">
            <ExternalLink size={12} />
            {t("courier_review.open_full")}
          </span>
        </a>
      ) : (
        <div className="h-40 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">
          {t("courier_review.not_provided")}
        </div>
      )}
    </div>
  );
};
