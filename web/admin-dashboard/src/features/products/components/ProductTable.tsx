import React, { memo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Image as ImageIcon, MoreHorizontal, Trash, Power, PowerOff, Eye, Upload, Pencil, Loader2 } from "lucide-react";
import { MeasurementType, type VendorProduct } from "@city-market/shared";
import { mediaService } from "@/services/api/media.service";
import { useToast } from "@/hooks/use-toast";

interface ProductTableProps {
  products: VendorProduct[];
  onEdit: (product: VendorProduct) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (product: VendorProduct) => void;
  onUploadImage: (id: string, imageUrl: string) => void;
  onViewImage: (product: VendorProduct) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const ProductTable: React.FC<ProductTableProps> = memo(
  ({ products, onEdit, onDelete, onToggleAvailability, onUploadImage, onViewImage, currentPage, totalPages, onPageChange }) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const handleImageUpload = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingId(productId);
      try {
        const result = await mediaService.upload(file, "products", productId);
        onUploadImage(productId, result.url);
      } catch (err: any) {
        toast({ title: t("common.upload_failed"), description: err?.response?.data?.message || err.message, variant: "destructive" });
      } finally {
        setUploadingId(null);
        const input = inputRefs.current[productId];
        if (input) input.value = "";
      }
    };

    return (
      <div className="space-y-4">
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">{t("common.image")}</TableHead>
                <TableHead>{t("common.product")}</TableHead>
                <TableHead>{t("common.vendor", "Vendor")}</TableHead>
                <TableHead>{t("common.global_category", "Global Category")}</TableHead>
                <TableHead>{t("common.vendor_category", "Store Category")}</TableHead>
                <TableHead>{t("common.price")}</TableHead>
                <TableHead>{t("common.stock")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => {
                if (!product) return null;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="relative h-12 w-12 overflow-hidden rounded bg-muted flex-shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {product.imageUrl && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewImage(product)} title={t("products.view_image")}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            type="button"
                            title={t("products.upload_image")}
                            disabled={uploadingId === product.id}
                            onClick={() => inputRefs.current[product.id]?.click()}
                          >
                            {uploadingId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                          <input
                            ref={(el) => { inputRefs.current[product.id] = el; }}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(product.id, e)}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-slate-600">{(product as any).vendorShopName || t("common.none")}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {product.globalCategoryName || t("common.none", "None")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal border-orange-200 text-orange-700 bg-orange-50">
                      {product.vendorCategoryName || t("common.none", "None")}
                    </Badge>
                  </TableCell>
                  <TableCell>${product.price.toFixed(2)}</TableCell>
                  <TableCell>
                    {product.measurementType === MeasurementType.WEIGHT ? (
                      <div className="flex flex-col">
                        <span className={(product.stockWeightGrams || 0) - (product.reservedWeightGrams || 0) < 5000 ? "text-destructive font-bold" : ""}>
                          {((product.stockWeightGrams || 0) / 1000).toFixed(2)} كجم
                        </span>
                        {product.reservedWeightGrams ? (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            ({(product.reservedWeightGrams / 1000).toFixed(2)} كجم محجوز)
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className={product.stockQuantity - (product.reservedQuantity ?? 0) < 10 ? "text-destructive font-bold" : ""}>
                          {product.stockQuantity}
                        </span>
                        {product.reservedQuantity ? (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">({product.reservedQuantity} reserved)</span>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isAvailable ? "default" : "secondary"}>
                      {product.isAvailable ? t("common.available") : t("common.not_available")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2" onClick={() => onEdit(product)}>
                          <Pencil className="h-4 w-4" /> {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onClick={() => onToggleAvailability(product)}>
                          {product.isAvailable ? (
                            <>
                              <PowerOff className="h-4 w-4" /> {t("products.deactivate")}
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4" /> {t("products.activate")}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(product.id)}>
                          <Trash className="h-4 w-4" /> {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t("products.no_products_found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} className="mt-4" />
      </div>
    );
  },
);

export default ProductTable;
