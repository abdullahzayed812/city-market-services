import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, X, Plus, Check } from "lucide-react";
import { MeasurementType } from "@city-market/shared";
import type { GlobalProduct, BulkAddVendorProductsFromGlobalItem } from "@city-market/shared";
import { useGlobalProductsPicker } from "@/hooks/useGlobalProductsPicker";

interface SelectedItem {
  product: GlobalProduct;
  price: number;
  stockQuantity: number;
  stockWeightGrams: number;
}

interface BulkAddProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (items: BulkAddVendorProductsFromGlobalItem[]) => Promise<{ added: number; skipped: number } | undefined>;
}

const BulkAddProductsDialog: React.FC<BulkAddProductsDialogProps> = ({ open, onOpenChange, onSubmit }) => {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { products, isLoading, isFetchingNextPage, hasMore, loadMore } = useGlobalProductsPicker({ search, enabled: open });

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);

  const toggleProduct = (product: GlobalProduct) => {
    setResult(null);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
      } else {
        next.set(product.id, { product, price: 0, stockQuantity: 0, stockWeightGrams: 0 });
      }
      return next;
    });
  };

  const updateSelected = (id: string, patch: Partial<Pick<SelectedItem, "price" | "stockQuantity" | "stockWeightGrams">>) => {
    setResult(null);
    setSelected((prev) => {
      const current = prev.get(id);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(id, { ...current, ...patch });
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
    setSelected(new Map());
    setResult(null);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (selectedList.length === 0) return;
    setIsSubmitting(true);
    try {
      const items: BulkAddVendorProductsFromGlobalItem[] = selectedList.map((item) => ({
        globalProductId: item.product.id,
        price: item.price,
        stockQuantity: item.product.measurementType === MeasurementType.WEIGHT ? undefined : item.stockQuantity,
        stockWeightGrams: item.product.measurementType === MeasurementType.WEIGHT ? item.stockWeightGrams : undefined,
      }));
      const summary = await onSubmit(items);
      if (summary) {
        setResult(summary);
        setSelected(new Map());
        toast.success(`${summary.added} ${t("products.bulk_added_count", "product(s) added")}, ${summary.skipped} ${t("products.bulk_skipped_count", "skipped (already exist)")}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("products.bulk_add_failed", "Failed to add products"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("products.bulk_add_title", "Add Products")}</DialogTitle>
          <DialogDescription>
            {t("products.bulk_add_description", "Search the global product catalog, select products, and set a price and stock for each before adding them to your store.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {selectedList.length > 0 && (
            <div className="space-y-2 border rounded-md p-2 max-h-64 overflow-y-auto">
              {selectedList.map(({ product, price, stockQuantity, stockWeightGrams }) => {
                const isWeight = product.measurementType === MeasurementType.WEIGHT;
                return (
                  <div key={product.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{product.name}</div>
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{isWeight ? t("products.price_per_kg") : t("products.price")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => updateSelected(product.id, { price: parseFloat(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{isWeight ? t("products.stock_grams") : t("products.stock")}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={isWeight ? stockWeightGrams : stockQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          updateSelected(product.id, isWeight ? { stockWeightGrams: val } : { stockQuantity: val });
                        }}
                        className="h-8"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("products.search_global_placeholder", "Search for products...")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="ps-9"
            />
          </div>

          <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
            {isLoading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin me-2" /> {t("common.loading")}
              </div>
            )}
            {!isLoading && products.length === 0 && (
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
                    {product.description && <span className="text-xs text-muted-foreground truncate max-w-[420px]">{product.description}</span>}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
            {hasMore && (
              <div className="text-center p-2">
                <Button variant="ghost" size="sm" onClick={() => loadMore()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.load_more")}
                </Button>
              </div>
            )}
          </div>

          {result && (
            <div className="flex gap-3 text-sm">
              <span className="text-green-600">
                {result.added} {t("products.bulk_added_count", "added")}
              </span>
              <span className="text-amber-600">
                {result.skipped} {t("products.bulk_skipped_count", "skipped (already exist)")}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={selectedList.length === 0 || isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("products.bulk_add_n", { count: selectedList.length, defaultValue: `Add ${selectedList.length} product(s)` })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddProductsDialog;
