import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X } from "lucide-react";
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

interface FileGroup {
  id: string;
  fileName: string;
  rows: ParsedRow[];
  columnError?: string;
  result?: BulkGlobalProductImportResult;
  submitError?: string;
}

const REQUIRED_COLUMNS = ["name"];

// Plain incrementing id — crypto.randomUUID() throws on non-secure (plain HTTP) origins,
// and these ids only need to be unique within this dialog's lifetime, not globally.
let nextFileGroupId = 0;
const makeFileGroupId = () => `f${nextFileGroupId++}`;

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
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const globalCategories = useMemo(() => categories.filter((c) => c.type === CategoryType.GLOBAL || !c.type), [categories]);

  const validRowCount = useMemo(() => fileGroups.reduce((sum, g) => sum + g.rows.filter((r) => !r.error).length, 0), [fileGroups]);
  const invalidRowCount = useMemo(() => fileGroups.reduce((sum, g) => sum + g.rows.filter((r) => r.error).length, 0), [fileGroups]);
  const hasColumnErrors = fileGroups.some((g) => g.columnError);

  const totals = useMemo(
    () =>
      fileGroups.reduce(
        (acc, g) => ({
          created: acc.created + (g.result?.created || 0),
          failed: acc.failed + (g.result?.failed || 0),
        }),
        { created: 0, failed: 0 },
      ),
    [fileGroups],
  );

  const reset = () => {
    setFileGroups([]);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setDone(false);

    const newGroups = await Promise.all(
      files.map(async (file) => {
        const parsed = await parseCsv(file, t);
        return {
          id: makeFileGroupId(),
          fileName: file.name,
          rows: parsed.rows,
          columnError: parsed.columnError,
        } as FileGroup;
      }),
    );

    setFileGroups((prev) => [...prev, ...newGroups]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setFileGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const handleSubmit = async () => {
    if (!globalCategoryId || validRowCount === 0) return;

    setIsSubmitting(true);
    setDone(false);
    try {
      // Files are processed one after another (not in parallel) — each call already
      // batches its own rows 5-at-a-time server-side (BULK_IMPORT_CONCURRENCY in
      // catalog.service.ts). Running multiple files concurrently on top of that would
      // multiply the image-download load the endpoint already treats as expensive.
      let createdTotal = 0;
      let failedTotal = 0;
      let filesWithErrors = 0;

      for (const group of fileGroups) {
        const validRows = group.rows.filter((r) => !r.error);
        if (validRows.length === 0) continue;

        setProcessingFileId(group.id);
        try {
          const importResult = await adminApi.bulkCreateGlobalProducts({
            items: validRows.map(({ name, description, imageUrl }) => ({ name, description, imageUrl })),
            globalCategoryId,
            measurementType,
            weightUnit: measurementType === MeasurementType.WEIGHT ? weightUnit : undefined,
          });
          createdTotal += importResult.created;
          failedTotal += importResult.failed;
          setFileGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, result: importResult } : g)));
        } catch (err: any) {
          filesWithErrors += 1;
          setFileGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, submitError: err.message } : g)));
        }
      }

      setDone(true);
      onImported?.();
      toast({
        title: t("common.success", "Success"),
        description:
          t("products.bulk_import_toast_success", {
            created: createdTotal,
            failed: failedTotal,
            defaultValue: `${createdTotal} product(s) created, ${failedTotal} failed.`,
          }) + (filesWithErrors > 0 ? ` ${filesWithErrors} file(s) failed to upload entirely.` : ""),
        variant: filesWithErrors > 0 ? "destructive" : undefined,
      });
    } finally {
      setProcessingFileId(null);
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
              "products.bulk_import_description_multi",
              "Add one or more CSV files (columns: name, description, imageUrl). Files are imported one after another, each in batches of 5, under the category and measurement type selected below.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("common.global_category", "Global Category")}</Label>
              <Select value={globalCategoryId} onValueChange={setGlobalCategoryId} disabled={isSubmitting}>
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
              <Select value={measurementType} onValueChange={(v) => setMeasurementType(v as MeasurementType)} disabled={isSubmitting}>
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
                <Select value={weightUnit} onValueChange={(v) => setWeightUnit(v as WeightUnit)} disabled={isSubmitting}>
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
            <Label>{t("products.csv_files", "CSV Files")}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            <p className="text-xs text-gray-500">
              {t("products.bulk_import_add_more_hint", "Select multiple files at once, or use this again to add more — they'll be queued up and imported one by one.")}
            </p>
          </div>

          {fileGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-green-600">
                  {t("products.bulk_import_valid_count", { count: validRowCount, defaultValue: `${validRowCount} valid` })}
                </span>
                {invalidRowCount > 0 && (
                  <span className="text-red-600">
                    {t("products.bulk_import_invalid_count", {
                      count: invalidRowCount,
                      defaultValue: `${invalidRowCount} invalid (will be skipped)`,
                    })}
                  </span>
                )}
              </div>

              <div className="border rounded-md divide-y">
                {fileGroups.map((group, i) => {
                  const groupValid = group.rows.filter((r) => !r.error).length;
                  const groupInvalid = group.rows.length - groupValid;
                  const isProcessing = processingFileId === group.id;
                  return (
                    <div key={group.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 shrink-0">#{i + 1}</span>
                        <Badge variant="secondary" className="truncate max-w-[160px]">
                          {group.fileName}
                        </Badge>
                        {group.columnError ? (
                          <span className="text-red-600 text-xs">{group.columnError}</span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {t("products.bulk_import_file_counts", {
                              valid: groupValid,
                              invalid: groupInvalid,
                              defaultValue: `${groupValid} valid, ${groupInvalid} invalid`,
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                        {group.result && (
                          <>
                            <span className="text-green-600 text-xs">{t("products.bulk_import_created_count", { count: group.result.created, defaultValue: `${group.result.created} created` })}</span>
                            {group.result.failed > 0 && (
                              <span className="text-red-600 text-xs">
                                {t("products.bulk_import_failed_count", { count: group.result.failed, defaultValue: `${group.result.failed} failed` })}
                              </span>
                            )}
                          </>
                        )}
                        {group.submitError && <span className="text-red-600 text-xs">{group.submitError}</span>}
                        {!isSubmitting && !group.result && !group.submitError && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(group.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {done && (
            <div className="flex gap-3 text-sm font-medium">
              <span className="text-green-600">
                {t("products.bulk_import_created_count", { count: totals.created, defaultValue: `${totals.created} created` })}
              </span>
              <span className="text-red-600">
                {t("products.bulk_import_failed_count", { count: totals.failed, defaultValue: `${totals.failed} failed` })}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            {t("common.close", "Close")}
          </Button>
          {!done && (
            <Button onClick={handleSubmit} disabled={!globalCategoryId || validRowCount === 0 || isSubmitting || hasColumnErrors} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isSubmitting
                ? t("products.bulk_import_processing", {
                    current: fileGroups.findIndex((g) => g.id === processingFileId) + 1,
                    total: fileGroups.length,
                    defaultValue: `Importing file ${fileGroups.findIndex((g) => g.id === processingFileId) + 1} of ${fileGroups.length}...`,
                  })
                : t("products.import_n_products", { count: validRowCount, defaultValue: `Import ${validRowCount} product(s)` })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportGlobalProductsDialog;
