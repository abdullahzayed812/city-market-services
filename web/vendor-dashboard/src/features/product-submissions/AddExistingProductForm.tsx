import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, PackageCheck } from "lucide-react";
import { MeasurementType, WeightUnit, type ProductDuplicateMatch } from "@city-market/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/AuthProvider";
import { productService } from "@/services/api/product.service";
import { useSubmissionErrorText } from "./useSubmissionErrorText";

// Adds an existing catalog product to the merchant's store with their price and stock
// (the same bulk-add endpoint as the "Add products" dialog; the server validates both)
export const AddExistingProductForm: React.FC<{ match: ProductDuplicateMatch; onAdded: (globalProductId: string) => void; onCancel: () => void }> = ({
  match,
  onAdded,
  onCancel,
}) => {
  const { t } = useTranslation();
  const errorText = useSubmissionErrorText();
  const queryClient = useQueryClient();
  const { vendor } = useAuth();
  const byWeight = match.measurementType === MeasurementType.WEIGHT;
  const inKg = (match.weightUnit ?? WeightUnit.KG) === WeightUnit.KG;
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: ({ priceValue, stockValue }: { priceValue: number; stockValue: number }) =>
      productService.bulkAddProductsFromGlobal(vendor!.id, [
        byWeight
          ? { globalProductId: match.globalProductId, price: priceValue, stockWeightGrams: Math.round(inKg ? stockValue * 1000 : stockValue) }
          : { globalProductId: match.globalProductId, price: priceValue, stockQuantity: Math.round(stockValue) },
      ]),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast.success(result?.added ? t("product_submissions.added_with_price") : t("product_submissions.already_in_store"));
      onAdded(match.globalProductId);
    },
    onError: (err) => setError(errorText(err)),
  });

  const submit = () => {
    const p = Number(price.replace(",", "."));
    const s = Number(stock.replace(",", "."));
    if (!price.trim() || !Number.isFinite(p) || p <= 0) return setError(t("product_submissions.errors.invalid_price"));
    if (!stock.trim() || !Number.isFinite(s) || s < 0 || (!byWeight && !Number.isInteger(s))) return setError(t("product_submissions.errors.invalid_stock"));
    setError(null);
    add.mutate({ priceValue: p, stockValue: s });
  };

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{byWeight ? t("product_submissions.price_per_kg") : t("product_submissions.price_per_unit")}</Label>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            {byWeight ? t("product_submissions.stock_weight", { unit: t(inKg ? "product_submissions.unit_kg" : "product_submissions.unit_gram") }) : t("product_submissions.stock_units")}
          </Label>
          <Input inputMode={byWeight ? "decimal" : "numeric"} value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={add.isPending}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={submit} disabled={add.isPending}>
          {add.isPending ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <PackageCheck className="me-1 h-4 w-4" />}
          {t("product_submissions.add_to_store")}
        </Button>
      </div>
    </div>
  );
};
