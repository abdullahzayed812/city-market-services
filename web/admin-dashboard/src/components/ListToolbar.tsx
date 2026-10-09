import React from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
}

// A select filter; "all" is the value meaning "no filter"
export const FilterSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  className?: string;
}> = ({ value, onChange, options, allLabel, className }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className={className ?? "w-[170px] bg-white"}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{allLabel}</SelectItem>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

// Search box + filters + result count, shown above admin tables
export const ListToolbar: React.FC<{
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  total?: number;
  children?: React.ReactNode;
}> = ({ search, onSearchChange, searchPlaceholder, total, children }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 my-4">
      {onSearchChange && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? t("list.search")}
            className="ps-9 pe-8 bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={t("list.clear_search")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {children}
      {total !== undefined && <span className="ms-auto text-sm text-slate-500">{t("list.results", { count: total })}</span>}
    </div>
  );
};
