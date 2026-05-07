import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Upload, Search, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Category, CategoryType } from "@city-market/shared";
import { useAdminProducts } from "@/hooks/useAdminProducts";
import CategoryFormDialog from "../features/categories/components/CategoryFormDialog";
import ImageUploader from "@/components/ImageUploader";

const CategoriesManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");

  const { categories, vendors, isLoadingCategories, isLoadingVendors } = useAdminProducts();

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter((category) => {
      const matchesSearch =
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesVendor = selectedVendorId === "all" || category.vendorId === selectedVendorId;

      const matchesTab =
        activeTab === "all" ||
        (activeTab === "global" && category.type === CategoryType.GLOBAL) ||
        (activeTab === "vendor" && category.type === CategoryType.VENDOR);

      return matchesSearch && matchesVendor && matchesTab;
    });
  }, [categories, searchTerm, selectedVendorId, activeTab]);

  const groupedCategories = useMemo(() => {
    if (activeTab !== "vendor") return { "all": filteredCategories };

    return filteredCategories.reduce((acc: Record<string, Category[]>, category) => {
      const vId = category.vendorId || "unknown";
      if (!acc[vId]) acc[vId] = [];
      acc[vId].push(category);
      return acc;
    }, {});
  }, [filteredCategories, activeTab]);

  const createMutation = useMutation({
    mutationFn: adminApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) => adminApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
      setIsDialogOpen(false);
      setEditingCategory(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
    },
  });

  const updateIconMutation = useMutation({
    mutationFn: ({ id, iconUrl }: { id: string; iconUrl: string }) => adminApi.updateCategoryIcon(id, iconUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
    },
  });

  const handleFormSubmit = (data: any) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleReset = () => {
    setSearchTerm("");
    setSelectedVendorId("all");
    setActiveTab("all");
  };

  const getVendorName = useCallback((vendorId?: string | null) => {
    if (!vendorId) return "-";
    const vendor = vendors?.find(v => v.id === vendorId);
    return vendor ? vendor.shopName : vendorId;
  }, [vendors]);

  if (isLoadingCategories || isLoadingVendors) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 p-6 animate-in fade-in zoom-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t("common.categories")}</h2>
          <p className="text-gray-500 text-sm">{t("categories.manage")}</p>
        </div>
        <Button
          onClick={() => {
            setEditingCategory(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t("categories.create_category")}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-3 w-full sm:w-[300px]">
            <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
            <TabsTrigger value="global">{t("categories.global")}</TabsTrigger>
            <TabsTrigger value="vendor">{t("categories.vendor")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t("categories.search_categories")}
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-[220px]">
          <Select
            value={selectedVendorId}
            onValueChange={setSelectedVendorId}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("products.select_vendor")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.shopName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="icon" onClick={handleReset} title={t("common.reset", "Reset Filters")}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <CategoryFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        category={editingCategory}
        vendors={vendors || []}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">{t("common.icon")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.type")}</TableHead>
              <TableHead>{t("common.vendor")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedCategories).map(([vendorId, items]) => (
              <React.Fragment key={vendorId}>
                {activeTab === "vendor" && (
                  <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                    <TableCell colSpan={6} className="py-2 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-50/80">
                      {getVendorName(vendorId === "unknown" ? null : vendorId)}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <ImageUploader
                        folder="categories"
                        entityId={category.id}
                        currentImageUrl={category.iconUrl || undefined}
                        onComplete={(result) => updateIconMutation.mutate({ id: category.id, iconUrl: result.url })}
                      >
                        {category.iconUrl ? (
                          <img src={category.iconUrl} alt={category.name} className="h-10 w-10 object-contain rounded border p-1" />
                        ) : (
                          <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 border">
                            <Upload size={16} />
                          </div>
                        )}
                      </ImageUploader>
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <Badge variant={category.type === CategoryType.GLOBAL ? "default" : "secondary"}>
                        {category.type === CategoryType.GLOBAL ? t("categories.global") : t("categories.vendor")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {getVendorName(category.vendorId)}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-[200px] truncate">{category.description}</TableCell>
                    <TableCell className="text-end space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(t("common.confirm_delete"))) {
                            deleteMutation.mutate(category.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
            {filteredCategories.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {t("categories.no_categories_found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CategoriesManagement;
