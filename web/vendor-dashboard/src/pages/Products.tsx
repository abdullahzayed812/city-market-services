import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProducts } from "@/hooks/useProducts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, MoreHorizontal, Plus, Pencil, Trash2, Upload } from "lucide-react";
import VendorProductImageModal from "@/components/ProductImageModal";

const Products = () => {
  const { t } = useTranslation();
  const {
    products,
    globalCategories,
    vendorCategories,
    globalProducts,
    isLoading,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    uploadVendorProductImage,
  } = useProducts();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    stockQuantity: 0,
    globalCategoryId: "",
    vendorCategoryId: "",
    globalProductId: "",
  });
  const [editingProduct, setEditingProduct] = useState<any>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t("common.loading")}</div>;
  }

  const handleGlobalProductSelect = (id: string) => {
    const selected = globalProducts.find((p: any) => p.id === id);
    if (selected) {
      setNewProduct({
        ...newProduct,
        globalProductId: id,
        name: selected.name,
        description: selected.description || "",
        globalCategoryId: selected.globalCategoryId,
      });
    } else {
      setNewProduct({
        ...newProduct,
        globalProductId: "",
      });
    }
  };

  const handleAddProduct = () => {
    createVendorProduct(newProduct, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setNewProduct({
          name: "",
          description: "",
          price: 0,
          stockQuantity: 0,
          globalCategoryId: "",
          vendorCategoryId: "",
          globalProductId: "",
        });
      },
    });
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      stockQuantity: product.stockQuantity,
      globalCategoryId: product.globalCategoryId,
      vendorCategoryId: product.vendorCategoryId,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = () => {
    if (editingProduct) {
      updateVendorProduct(
        {
          id: editingProduct.id,
          data: {
            name: editingProduct.name,
            description: editingProduct.description,
            price: editingProduct.price,
            stockQuantity: editingProduct.stockQuantity,
            globalCategoryId: editingProduct.globalCategoryId,
            vendorCategoryId: editingProduct.vendorCategoryId,
          },
        },
        {
          onSuccess: () => {
            setIsEditDialogOpen(false);
            setEditingProduct(null);
          },
        },
      );
    }
  };

  const handleImageUpload = (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadVendorProductImage({ id: productId, file });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("products.title")}</h1>
          <p className="text-muted-foreground">{t("products.subtitle")}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> {t("products.add_product")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("products.add_new_product")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("products.add_product_description", "Create a new product listing for your shop.")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="global-product-select">{t("products.link_to_global")}</Label>
                <Select
                  value={newProduct.globalProductId || "none"}
                  onValueChange={handleGlobalProductSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("products.select_existing")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    <SelectItem value="none">{t("products.none_create_new")}</SelectItem>
                    {globalProducts.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("products.global_catalog_info")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t("products.product_name")}</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  disabled={!!newProduct.globalProductId && newProduct.globalProductId !== "none"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="global-category">{t("products.global_category")}</Label>
                  <Select
                    value={newProduct.globalCategoryId}
                    onValueChange={(val) => setNewProduct({ ...newProduct, globalCategoryId: val })}
                    disabled={!!newProduct.globalProductId && newProduct.globalProductId !== "none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("products.select_global_category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {globalCategories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-category">{t("products.store_category")}</Label>
                  <Select
                    value={newProduct.vendorCategoryId}
                    onValueChange={(val) => setNewProduct({ ...newProduct, vendorCategoryId: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("products.select_store_category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorCategories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t("products.price")}</Label>
                  <Input
                    id="price"
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">{t("products.stock")}</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={newProduct.stockQuantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("products.description")}</Label>
                <Input
                  id="description"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleAddProduct}>
                {t("products.create_product")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("products.edit_product")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("products.edit_product_description", "Update details for your shop product.")}
              </DialogDescription>
            </DialogHeader>
            {editingProduct && (
              <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t("products.product_name")}</Label>
                  <Input
                    id="edit-name"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    disabled={!!editingProduct.globalProductId}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-global-category">{t("products.global_category")}</Label>
                    <Select
                      value={editingProduct.globalCategoryId}
                      onValueChange={(val) => setEditingProduct({ ...editingProduct, globalCategoryId: val })}
                      disabled={!!editingProduct.globalProductId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("products.select_global_category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {globalCategories.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-vendor-category">{t("products.store_category")}</Label>
                    <Select
                      value={editingProduct.vendorCategoryId}
                      onValueChange={(val) => setEditingProduct({ ...editingProduct, vendorCategoryId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("products.select_store_category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorCategories.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">{t("products.price")}</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-stock">{t("products.stock")}</Label>
                    <Input
                      id="edit-stock"
                      type="number"
                      value={editingProduct.stockQuantity}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, stockQuantity: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t("products.description")}</Label>
                  <Input
                    id="edit-description"
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleUpdateProduct}>
                  {t("products.update_product")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">{t("products.table.image")}</TableHead>
              <TableHead>{t("products.table.product")}</TableHead>
              <TableHead>{t("products.table.global_category")}</TableHead>
              <TableHead>{t("products.table.store_category")}</TableHead>
              <TableHead>{t("products.table.price")}</TableHead>
              <TableHead>{t("products.table.stock")}</TableHead>
              <TableHead>{t("products.table.status")}</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products?.map((product: any) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="relative h-12 w-12 overflow-hidden rounded bg-muted flex-shrink-0">
                      {product.imageUrl ? (
                        <img
                          src={
                            product.imageUrl.startsWith("/")
                              ? `${import.meta.env.VITE_API_BASE_URL}${product.imageUrl}`
                              : product.imageUrl
                          }
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
                <TableCell>{product.globalCategoryName || t("common.none")}</TableCell>
                <TableCell>{product.vendorCategoryName || t("common.none")}</TableCell>
                <TableCell>${product.price}</TableCell>
                <TableCell>
                  <span className={product.stockQuantity < 10 ? "text-destructive font-bold" : ""}>
                    {product.stockQuantity}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={product.isAvailable ? "default" : "secondary"}>
                    {product.isAvailable ? t("products.available") : t("products.not_available")}
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
                      <DropdownMenuItem className="gap-2" onClick={() => handleEditProduct(product)}>
                        <Pencil className="h-4 w-4" /> {t("products.edit_product")}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive" onClick={() => deleteVendorProduct(product.id)}>
                        <Trash2 className="h-4 w-4" /> {t("products.delete_product")}
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

      <VendorProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false);
          setSelectedProduct(null);
        }}
        imageUrl={selectedProduct?.imageUrl || null}
        productName={selectedProduct?.name || t("products.table.product")}
      />
    </div >
  );
};

export default Products;
