import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, MoreHorizontal, Trash, Eye } from "lucide-react";
import { type GlobalProduct, MeasurementType } from "@city-market/shared";

interface GlobalProductTableProps {
    products: GlobalProduct[];
    onDelete: (id: string) => void;
    onViewImage: (product: GlobalProduct) => void;
    hasMore: boolean;
    onLoadMore: () => void;
    isFetchingNextPage: boolean;
}

const GlobalProductTable: React.FC<GlobalProductTableProps> = memo(
    ({ products, onDelete, onViewImage, hasMore, onLoadMore, isFetchingNextPage }) => {
        const { t } = useTranslation();

        return (
            <div className="space-y-4">
                <div className="border rounded-lg bg-card overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">{t("common.image")}</TableHead>
                                <TableHead>{t("common.product")}</TableHead>
                                <TableHead>{t("common.description")}</TableHead>
                                <TableHead>{t("products.measurement_type")}</TableHead>
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
                                                {product.imageUrl && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewImage(product)} title={t("products.view_image")}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {product.description || <span className="italic">{t("common.none")}</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal">
                                                {product.measurementType === MeasurementType.WEIGHT ? t("products.weight") : t("products.unit")}
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
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
    },
);

export default GlobalProductTable;
