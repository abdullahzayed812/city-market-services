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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, MoreHorizontal, Plus, Pencil, Trash2, Upload } from "lucide-react";
import ProductImageModal from "@/components/ProductImageModal";

const Products = () => {
  const { t } = useTranslation();
  const {
    products,
    globalCategories,
    vendorCategories,
    isLoading,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadImage,
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
  });
  const [editingProduct, setEditingProduct] = useState<any>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const handleAddProduct = () => {
    createProduct(newProduct, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setNewProduct({
          name: "",
          description: "",
          price: 0,
          stockQuantity: 0,
          globalCategoryId: "",
          vendorCategoryId: "",
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
      updateProduct(
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
      uploadImage({ id: productId, file });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("common.products")}</h1>
          <p className="text-muted-foreground">Manage your store's product catalog.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="global-category">Global Category</Label>
                  <Select
                    value={newProduct.globalCategoryId}
                    onValueChange={(val) => setNewProduct({ ...newProduct, globalCategoryId: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select global category" />
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
                  <Label htmlFor="vendor-category">Store Category</Label>
                  <Select
                    value={newProduct.vendorCategoryId}
                    onValueChange={(val) => setNewProduct({ ...newProduct, vendorCategoryId: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select store category" />
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
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={newProduct.stockQuantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleAddProduct}>
                Create Product
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
            </DialogHeader>
            {editingProduct && (
              <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input
                    id="edit-name"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-global-category">Global Category</Label>
                    <Select
                      value={editingProduct.globalCategoryId}
                      onValueChange={(val) => setEditingProduct({ ...editingProduct, globalCategoryId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select global category" />
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
                    <Label htmlFor="edit-vendor-category">Store Category</Label>
                    <Select
                      value={editingProduct.vendorCategoryId}
                      onValueChange={(val) => setEditingProduct({ ...editingProduct, vendorCategoryId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select store category" />
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
                    <Label htmlFor="edit-price">Price ($)</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-stock">Stock</Label>
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
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleUpdateProduct}>
                  Update Product
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
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Global Category</TableHead>
              <TableHead>Store Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
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
                          title="Upload image"
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
                <TableCell>{product.globalCategoryName || "None"}</TableCell>
                <TableCell>{product.vendorCategoryName || "None"}</TableCell>
                <TableCell>${product.price}</TableCell>
                <TableCell>
                  <span className={product.stockQuantity < 10 ? "text-destructive font-bold" : ""}>
                    {product.stockQuantity}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={product.isAvailable ? "default" : "secondary"}>
                    {product.isAvailable ? "Available" : "Not available"}
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
                        <Pencil className="h-4 w-4" /> Edit Product
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive" onClick={() => deleteProduct(product.id)}>
                        <Trash2 className="h-4 w-4" /> Delete Product
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false);
          setSelectedProduct(null);
        }}
        imageUrl={selectedProduct?.imageUrl || null}
        productName={selectedProduct?.name || "Product"}
      />
    </div>
  );
};

export default Products;
