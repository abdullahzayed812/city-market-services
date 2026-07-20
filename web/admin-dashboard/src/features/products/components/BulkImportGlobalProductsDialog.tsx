import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Upload } from "lucide-react";
import { type Category, CategoryType, MeasurementType, WeightUnit } from "@city-market/shared";
import { adminApi, type BulkGlobalProductImportItem, type BulkGlobalProductImportResult } from "@/services/api/admin-api";
import { useToast } from "@/hooks/use-toast";

interface BulkImportGlobalProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImported?: () => void;
}

interface ParsedRow extends BulkGlobalProductImportItem {
  rowNumber: number;
  error?: string;
}

const REQUIRED_COLUMNS = ["name"];

function parseCsv(file: File, t: ReturnType<typeof useTranslation>["t"]): Promise<{ rows: ParsedRow[]; columnError?: string }> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (result) => {
        const fields = result.meta.fields?.map((f) => f.trim().toLowerCase()) || [];
        const missing = REQUIRED_COLUMNS.filter((col) => !fields.includes(col));
        if (missing.length > 0) {
          resolve({
            rows: [],
            columnError: t("products.bulk_import_missing_columns", {
              columns: missing.join(", "),
              defaultValue: `Missing required column(s): ${missing.join(", ")}`,
            }),
          });
          return;
        }

        const rows: ParsedRow[] = result.data.map((raw, i) => {
          const name = (raw.name || "").trim();
          const imageUrl = (raw.imageurl || raw.image_url || "").trim();
          let error: string | undefined;
          if (!name) error = t("products.bulk_import_row_missing_name", "Missing name");
          else if (imageUrl && !/^https?:\/\//i.test(imageUrl))
            error = t("products.bulk_import_row_invalid_image_url", "Image URL must start with http(s)://");

          return {
            rowNumber: i + 2, // +1 for header row, +1 for 1-based index
            name,
            description: (raw.description || "").trim() || undefined,
            imageUrl: imageUrl || undefined,
            error,
          };
        });

        resolve({ rows });
      },
    });
  });
}

const BulkImportGlobalProductsDialog: React.FC<BulkImportGlobalProductsDialogProps> = ({ open, onOpenChange, categories, onImported }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [globalCategoryId, setGlobalCategoryId] = useState<string>("");
  const [measurementType, setMeasurementType] = useState<MeasurementType>(MeasurementType.UNIT);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(WeightUnit.KG);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columnError, setColumnError] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkGlobalProductImportResult | null>(null);

  const globalCategories = useMemo(() => categories.filter((c) => c.type === CategoryType.GLOBAL || !c.type), [categories]);
  const validRows = useMemo(() => rows.filter((r) => !r.error), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.error), [rows]);

  const reset = () => {
    setRows([]);
    setColumnError(undefined);
    setFileName("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const parsed = await parseCsv(file, t);
    setColumnError(parsed.columnError);
    setRows(parsed.rows);
  };

  const handleSubmit = async () => {
    if (!globalCategoryId || validRows.length === 0) return;

    setIsSubmitting(true);
    try {
      const importResult = await adminApi.bulkCreateGlobalProducts({
        items: validRows.map(({ name, description, imageUrl }) => ({ name, description, imageUrl })),
        globalCategoryId,
        measurementType,
        weightUnit: measurementType === MeasurementType.WEIGHT ? weightUnit : undefined,
      });
      setResult(importResult);
      onImported?.();
      toast({
        title: t("common.success", "Success"),
        description: t("products.bulk_import_toast_success", {
          created: importResult.created,
          failed: importResult.failed,
          defaultValue: `${importResult.created} product(s) created, ${importResult.failed} failed.`,
        }),
      });
    } catch (err: any) {
      toast({
        title: t("common.error", "Error"),
        description: `${t("products.bulk_import_toast_failed_prefix", "Bulk import failed")}: ${err.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("products.bulk_import_title", "Bulk Import Global Products")}</DialogTitle>
          <DialogDescription>
            {t(
              "products.bulk_import_description",
              "Upload a CSV with columns: name, description, imageUrl. Every product in this batch is created under the category and measurement type selected below.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("common.global_category", "Global Category")}</Label>
              <Select value={globalCategoryId} onValueChange={setGlobalCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("products.select_category", "Select category")} />
                </SelectTrigger>
                <SelectContent>
                  {globalCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("products.measurement_type", "Measurement Type")}</Label>
              <Select value={measurementType} onValueChange={(v) => setMeasurementType(v as MeasurementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MeasurementType.UNIT}>{t("products.unit", "Unit")}</SelectItem>
                  <SelectItem value={MeasurementType.WEIGHT}>{t("products.weight", "Weight")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {measurementType === MeasurementType.WEIGHT && (
              <div className="space-y-1.5">
                <Label>{t("products.weight_unit", "Weight Unit")}</Label>
                <Select value={weightUnit} onValueChange={(v) => setWeightUnit(v as WeightUnit)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WeightUnit.KG}>{t("products.kg", "KG")}</SelectItem>
                    <SelectItem value={WeightUnit.GRAM}>{t("products.gram", "Gram")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t("products.csv_file", "CSV File")}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </div>

          {columnError && <div className="text-sm text-red-600">{columnError}</div>}

          {!columnError && rows.length > 0 && !result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{fileName}</Badge>
                <span className="text-green-600">
                  {t("products.bulk_import_valid_count", { count: validRows.length, defaultValue: `${validRows.length} valid` })}
                </span>
                {invalidRows.length > 0 && (
                  <span className="text-red-600">
                    {t("products.bulk_import_invalid_count", {
                      count: invalidRows.length,
                      defaultValue: `${invalidRows.length} invalid (will be skipped)`,
                    })}
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t("common.name", "Name")}</TableHead>
                      <TableHead>{t("common.description", "Description")}</TableHead>
                      <TableHead>{t("products.image_url_column", "Image URL")}</TableHead>
                      <TableHead>{t("common.status", "Status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.rowNumber} className={row.error ? "bg-red-50" : undefined}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{row.name || "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{row.description || "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{row.imageUrl || "—"}</TableCell>
                        <TableCell>
                          {row.error ? (
                            <span className="text-xs text-red-600">{row.error}</span>
                          ) : (
                            <Badge variant="outline">{t("products.ready", "Ready")}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex gap-3 text-sm">
                <span className="text-green-600">
                  {t("products.bulk_import_created_count", { count: result.created, defaultValue: `${result.created} created` })}
                </span>
                <span className="text-red-600">
                  {t("products.bulk_import_failed_count", { count: result.failed, defaultValue: `${result.failed} failed` })}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.name", "Name")}</TableHead>
                      <TableHead>{t("common.status", "Status")}</TableHead>
                      <TableHead>{t("products.details_column", "Details")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results.map((r) => (
                      <TableRow key={r.index}>
                        <TableCell className="max-w-[160px] truncate">{r.name}</TableCell>
                        <TableCell>
                          {r.status === "ok" && <Badge>{t("products.status_ok", "OK")}</Badge>}
                          {r.status === "image_failed" && <Badge variant="secondary">{t("products.image_failed", "Image failed")}</Badge>}
                          {r.status === "error" && <Badge variant="destructive">{t("common.error", "Error")}</Badge>}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-gray-500">{r.error || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            {t("common.close", "Close")}
          </Button>
          {!result && (
            <Button onClick={handleSubmit} disabled={!globalCategoryId || validRows.length === 0 || isSubmitting || !!columnError} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t("products.import_n_products", { count: validRows.length, defaultValue: `Import ${validRows.length} product(s)` })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportGlobalProductsDialog;
