import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, Phone, Plus, Edit } from "lucide-react";
import { ShopStatus } from "@city-market/shared";
import { useToast } from "@/hooks/use-toast";
import VendorFormDialog from "@/features/vendors/components/VendorFormDialog";
import ImageUploader from "@/components/ImageUploader";

const VendorsManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: async () => {
      const response = await adminApi.getVendors();
      return response.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ShopStatus }) => adminApi.updateVendorStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast({ description: t("vendors.status_updated") });
    },
  });

  const updateVendorMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...rest } = data;
      await adminApi.updateVendor(id, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      setIsEditDialogOpen(false);
      setEditingVendor(null);
      toast({ description: t("common.success") });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.response?.data?.message || t("common.error"),
      });
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: (data: any) => adminApi.registerVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      setIsCreateDialogOpen(false);
      toast({ description: t("vendors.created_success") });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.response?.data?.message || t("common.error"),
      });
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) => adminApi.updateVendorImage(id, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast({ description: t("vendors.image_uploaded") });
    },
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.vendors")}</h2>
        <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus size={16} />
          {t("vendors.add_new")}
        </Button>

        <VendorFormDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          vendor={null}
          isCreate={true}
          onSubmit={(data) => createVendorMutation.mutate(data)}
          isPending={createVendorMutation.isPending}
        />

        <VendorFormDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          vendor={editingVendor}
          onSubmit={(data) => updateVendorMutation.mutate(data)}
          isPending={updateVendorMutation.isPending}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">{t("common.image")}</TableHead>
              <TableHead>{t("vendors.shop_name")}</TableHead>
              <TableHead>{t("vendors.address")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors?.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell>
                  <ImageUploader
                    folder="vendors"
                    entityId={vendor.id}
                    currentImageUrl={vendor.storeImage || undefined}
                    onComplete={(result) => updateImageMutation.mutate({ id: vendor.id, imageUrl: result.url })}
                  >
                    {vendor.storeImage ? (
                      <img src={vendor.storeImage} alt={vendor.shopName} className="h-10 w-10 object-cover rounded border" />
                    ) : (
                      <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-400 border">
                        <Store size={16} />
                      </div>
                    )}
                  </ImageUploader>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{vendor.shopName}</div>
                  <div className="text-xs text-gray-500 flex items-center mt-0.5">
                    <Phone size={10} className="me-1" />
                    {vendor.phone}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-gray-600 text-sm">{vendor.address}</TableCell>
                <TableCell>
                  <Badge variant={vendor.status === "OPEN" ? "default" : "secondary"}>{vendor.status}</Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="me-2"
                    onClick={() => {
                      setEditingVendor(vendor);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: vendor.id,
                        status: vendor.status === "OPEN" ? ShopStatus.CLOSED : ShopStatus.OPEN,
                      })
                    }
                  >
                    {vendor.status === "OPEN" ? t("common.deactivate") : t("common.activate")}
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

export default VendorsManagement;
