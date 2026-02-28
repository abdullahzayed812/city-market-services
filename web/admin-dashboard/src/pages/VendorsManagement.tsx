import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Store, MapPin, Phone, CheckCircle2, XCircle, Upload } from "lucide-react";
import { ShopStatus } from "@city-market/shared";

const VendorsManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: async () => {
      const response = await adminApi.getVendors();
      return response.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ShopStatus }) => 
      adminApi.updateVendorStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminVendors"] }),
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => adminApi.uploadVendorImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      setUploadingId(null);
    },
  });

  const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingId(id);
      uploadImageMutation.mutate({ id, file });
    }
  };

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.vendors")}</h2>

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
                  <div className="relative group">
                    {vendor.storeImage ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api/v1`}${vendor.storeImage}`}
                        alt={vendor.shopName}
                        className="h-10 w-10 object-cover rounded border"
                      />
                    ) : (
                      <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-400 border">
                        <Store size={16} />
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded">
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(vendor.id, e)}
                        disabled={uploadingId === vendor.id}
                      />
                      <Upload size={14} className="text-white" />
                    </label>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{vendor.shopName}</div>
                  <div className="text-xs text-gray-500 flex items-center mt-0.5">
                    <Phone size={10} className="me-1" />
                    {vendor.phone}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-gray-600 text-sm">
                  {vendor.address}
                </TableCell>
                <TableCell>
                  <Badge variant={vendor.status === "OPEN" ? "default" : "secondary"}>
                    {vendor.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ 
                      id: vendor.id, 
                      status: vendor.status === "OPEN" ? ShopStatus.CLOSED : ShopStatus.OPEN 
                    })}
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
