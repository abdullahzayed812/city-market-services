import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, X, Plus, Check, PackagePlus } from "lucide-react";
import { type GlobalProduct, CategoryType } from "@city-market/shared";
import { useGlobalProducts } from "@/hooks/useGlobalProducts";
import { adminApi } from "@/services/api/admin-api";
import { useToast } from "@/hooks/use-toast";

interface AddVendorProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId?: string;
  vendorName?: string;
  onAdded?: () => void;
}

const AddVendorProductsDialog: React.FC<AddVendorProductsDialogProps> = ({ open, onOpenChange, vendorId, vendorName, onAdded }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [globalCategoryId, setGlobalCategoryId] = useState<string>("");
  const [vendorCategoryId, setVendorCategoryId] = useState<string>("");
  const [selected, setSelected] = useState<Map<string, GlobalProduct>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingCategory, setIsImportingCategory] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data: categories } = useQuery({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const response = await adminApi.getCategories();
      return response.data.data;
    },
    enabled: open,
  });
  const globalCategories = useMemo(() => categories?.filter((c) => c.type === CategoryType.GLOBAL) ?? [], [categories]);
  const vendorCategories = useMemo(
    () => categories?.filter((c) => c.type === CategoryType.VENDOR && c.vendorId === vendorId) ?? [],
    [categories, vendorId],
  );

  const { products, total, isLoadingProducts, page, totalPages, setPage } = useGlobalProducts({
    initialLimit: 20,
    search,
    globalCategoryId: globalCategoryId || undefined,
    enabled: open,
  });

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);

  const toggleProduct = (product: GlobalProduct) => {
    setResult(null);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.set(product.id, product);
      return next;
    });
  };

  const removeProduct = (id: string) => {
    setResult(null);
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const reset = () => {
    setSearchInput("");
    setSearch("");
    setGlobalCategoryId("");
    setVendorCategoryId("");
    setSelected(new Map());
    setResult(null);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!vendorId || selected.size === 0) return;
    setIsSubmitting(true);
    try {
      const summary = await adminApi.bulkAddVendorProductsFromGlobal(vendorId, Array.from(selected.keys()), vendorCategoryId || undefined);
      setResult({ added: summary.added, skipped: summary.skipped });
      setSelected(new Map());
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      onAdded?.();
      toast({
        title: t("common.success"),
        description: t("vendors.add_products_success", { added: summary.added, skipped: summary.skipped }),
      });
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: `${t("vendors.add_products_failed")}: ${err.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportCategory = async () => {
    if (!vendorId || !globalCategoryId) return;
    setIsImportingCategory(true);
    try {
      const summary = await adminApi.bulkAddVendorProductsFromCategory(vendorId, globalCategoryId, vendorCategoryId || undefined);
      setResult({ added: summary.added, skipped: summary.skipped });
      queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      onAdded?.();
      toast({
        title: t("common.success"),
        description: t("vendors.add_products_success", { added: summary.added, skipped: summary.skipped }),
      });
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: `${t("vendors.add_products_failed")}: ${err.message}`,
        variant: "destructive",
      });
    } finally {
      setIsImportingCategory(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("vendors.add_products_title", "Add Products")}
            {vendorName ? ` — ${vendorName}` : ""}
          </DialogTitle>
          <DialogDescription>
            {t("vendors.add_products_description", "Search the global product catalog and select the products to add to this vendor.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {selectedList.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20 max-h-32 overflow-y-auto">
              {selectedList.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1 pe-1">
                  {p.name}
                  <button type="button" onClick={() => removeProduct(p.id)} className="ms-1 rounded-full hover:bg-black/10 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t("vendors.search_global_products", "Search products by name...")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="ps-9"
              />
            </div>
            <Select value={globalCategoryId || "all"} onValueChange={(val) => setGlobalCategoryId(val === "all" ? "" : val)}>
              <SelectTrigger className="sm:w-[220px]">
                <SelectValue placeholder={t("products.filter_by_global", "Filter by Global Category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all", "All")}</SelectItem>
                {globalCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("products.store_category", "Store Category")}</Label>
            <Select value={vendorCategoryId || "none"} onValueChange={(val) => setVendorCategoryId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder={t("products.select_store_category", "Select store category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.none", "None")}</SelectItem>
                {vendorCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t(
                "vendors.add_products_store_category_hint",
                "Applied to every product added in this batch. Only this vendor's own categories are listed — if empty, they haven't created any yet.",
              )}
            </p>
          </div>

          {globalCategoryId && (
            <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-md p-3">
              <p className="text-sm text-muted-foreground">
                {t("vendors.category_product_count", { count: total, defaultValue: `${total} product(s) in this category` })}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleImportCategory}
                disabled={total === 0 || isImportingCategory}
                className="gap-2 flex-shrink-0"
              >
                {isImportingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                {t("vendors.import_all_from_category", "Import All From Category")}
              </Button>
            </div>
          )}

          <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
            {isLoadingProducts && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin me-2" /> {t("common.loading")}
              </div>
            )}
            {!isLoadingProducts && products.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">{t("products.no_products_found")}</div>
            )}
            {products.map((product) => {
              const isSelected = selected.has(product.id);
              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => toggleProduct(product)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{product.name}</span>
                    {product.description && <span className="text-xs text-muted-foreground truncate max-w-[380px]">{product.description}</span>}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

          {result && (
            <div className="flex gap-3 text-sm">
              <span className="text-green-600">
                {result.added} {t("vendors.products_added", "added")}
              </span>
              <span className="text-amber-600">
                {result.skipped} {t("vendors.products_skipped", "skipped (already exist)")}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            {t("common.close", "Close")}
          </Button>
          <Button onClick={handleSubmit} disabled={selected.size === 0 || isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("vendors.add_n_products", { count: selected.size, defaultValue: `Add ${selected.size} product(s)` })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddVendorProductsDialog;
