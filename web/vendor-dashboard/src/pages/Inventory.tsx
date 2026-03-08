import { useTranslation } from "react-i18next";
import { useProducts } from "@/hooks/useProducts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Save } from "lucide-react";
import { useState } from "react";

const Inventory = () => {
  const { t } = useTranslation();
  const { products, isLoading, updateStock } = useProducts();
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const handleStockChange = (id: string, value: string) => {
    setStockEdits({ ...stockEdits, [id]: parseInt(value) || 0 });
  };

  const handleSaveStock = (id: string) => {
    const newStock = stockEdits[id];
    if (newStock !== undefined) {
      updateStock(
        { id, stock: newStock },
        {
          onSuccess: () => {
            const newEdits = { ...stockEdits };
            delete newEdits[id];
            setStockEdits(newEdits);
          },
        }
      );
    }
  };

  const lowStockProducts = products.filter((p: any) => p.stockQuantity < 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("common.inventory")}</h1>
        <p className="text-muted-foreground">Monitor and update your product stock levels.</p>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg flex items-start gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div>
            <h3 className="font-semibold">Low Stock Warning</h3>
            <p className="text-sm opacity-90">{lowStockProducts.length} products are running low on stock.</p>
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>New Stock</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product: any) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <span className={product.stockQuantity < 10 ? "text-destructive font-bold" : ""}>
                    {product.stockQuantity}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-24"
                    value={stockEdits[product.id] ?? product.stockQuantity}
                    onChange={(e) => handleStockChange(product.id, e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={stockEdits[product.id] === undefined}
                    onClick={() => handleSaveStock(product.id)}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Inventory;
