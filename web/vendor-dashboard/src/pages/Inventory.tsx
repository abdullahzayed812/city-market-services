import { useTranslation } from "react-i18next";
import { useProducts } from "@/hooks/useProducts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Save } from "lucide-react";
import { useState } from "react";
import { MeasurementType, type VendorProduct, WeightUnit } from "@city-market/shared";

const Inventory = () => {
  const { t } = useTranslation();
  const { products, isLoading, updateStock } = useProducts();
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  const handleStockChange = (id: string, value: string) => {
    setStockEdits({ ...stockEdits, [id]: parseFloat(value) || 0 });
  };

  const handleSaveStock = (product: VendorProduct) => {
    const newValue = stockEdits[product.id];
    if (newValue !== undefined) {
      const updatePayload: any = { id: product.id };
      if (product.measurementType === MeasurementType.WEIGHT) {
        // Convert to grams if the unit is KG
        const weightInGrams = product.weightUnit === WeightUnit.KG ? newValue * 1000 : newValue;
        updatePayload.weight = weightInGrams;
      } else {
        updatePayload.stock = Math.round(newValue);
      }

      updateStock(updatePayload, {
        onSuccess: () => {
          const newEdits = { ...stockEdits };
          delete newEdits[product.id];
          setStockEdits(newEdits);
        },
      });
    }
  };

  const isLowStock = (product: VendorProduct) => {
    if (product.measurementType === MeasurementType.WEIGHT) {
      // Threshold in grams (e.g., 5000g = 5kg)
      return (product.stockWeightGrams || 0) < 5000;
    }
    return product.stockQuantity < 10;
  };

  const lowStockProducts = products.filter(isLowStock);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("inventory.title")}</h1>
        <p className="text-muted-foreground">{t("inventory.subtitle")}</p>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg flex items-start gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div>
            <h3 className="font-semibold">{t("inventory.low_stock_warning")}</h3>
            <p className="text-sm opacity-90">{t("inventory.low_stock_desc", { count: lowStockProducts.length })}</p>
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("inventory.product")}</TableHead>
              <TableHead>{t("inventory.measurement")}</TableHead>
              <TableHead>{t("inventory.current_stock")}</TableHead>
              <TableHead>{t("inventory.new_stock")}</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product: VendorProduct) => {
              const isWeight = product.measurementType === MeasurementType.WEIGHT;

              // Determine display value and unit
              let currentValue = product.stockQuantity;
              let displayValue = currentValue;
              let unitLabel = t("inventory.unit");

              if (isWeight) {
                const grams = product.stockWeightGrams || 0;
                if (product.weightUnit === WeightUnit.KG) {
                  displayValue = grams / 1000;
                  unitLabel = t("inventory.units.kg");
                } else {
                  displayValue = grams;
                  unitLabel = t("inventory.units.gram");
                }
              }

              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-1 bg-slate-100 rounded-full font-medium text-slate-600">
                      {isWeight ? t("inventory.weight") : t("inventory.unit")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={isLowStock(product) ? "text-destructive font-bold" : "text-slate-700"}>
                      {displayValue} {unitLabel}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step={isWeight ? "0.1" : "1"}
                        className="w-24 bg-slate-50 border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                        value={stockEdits[product.id] ?? displayValue}
                        onChange={(e) => handleStockChange(product.id, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[30px]">{unitLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                      disabled={stockEdits[product.id] === undefined}
                      onClick={() => handleSaveStock(product)}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Inventory;
