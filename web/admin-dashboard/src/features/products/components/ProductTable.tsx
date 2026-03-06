import React, { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, MoreHorizontal, Trash, Power, PowerOff, Eye, Upload, Pencil } from "lucide-react";
import { type VendorProduct } from "@city-market/shared";

interface ProductTableProps {
  products: VendorProduct[];
  onEdit: (product: VendorProduct) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (product: VendorProduct) => void;
  onUploadImage: (id: string, file: File) => void;
  onViewImage: (product: VendorProduct) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isFetchingNextPage: boolean;
}

const ProductTable: React.FC<ProductTableProps> = memo(({
  products,
  onEdit,
  onDelete,
  onToggleAvailability,
  onUploadImage,
  onViewImage,
  hasMore,
  onLoadMore,
  isFetchingNextPage,
}) => {
  const { t } = useTranslation();

  const handleImageUpload = (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(productId, file);
    }
  };

  const getImageUrl = useCallback((path: string) => {
    const baseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api/v1`;
    return `${baseUrl}${path}`;
  }, []);

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
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="relative h-12 w-12 overflow-hidden rounded bg-muted flex-shrink-0">
                      {product.imageUrl ? (
                        <img
                          src={getImageUrl(product.imageUrl)}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {product.imageUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onViewImage(product)}
                          title={t("products.view_image")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Label htmlFor={`img-${product.id}`} className="cursor-pointer">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          type="button"
                          title={t("products.upload_image")}
                          asChild
                        >
                          <span>
                            <Upload className="h-4 w-4" />
                          </span>
                        </Button>
                      </Label>
                      <input
                        id={`img-${product.id}`}
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
                  <span className={product.stockQuantity < 10 ? "text-destructive font-bold" : ""}>
                    {product.stockQuantity}
                  </span>
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
            ))}
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

      {hasMore && (
        <div className="text-center mt-4">
          <Button onClick={onLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? t("common.loading") : t("common.load_more")}
          </Button>
        </div>
      )}
    </div>
  );
});

export default ProductTable;
