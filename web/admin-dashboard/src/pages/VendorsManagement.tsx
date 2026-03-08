import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Store, Phone, Upload, Plus } from "lucide-react";
import { ShopStatus } from "@city-market/shared";
import { useToast } from "@/hooks/use-toast";

const VendorsManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newVendor, setNewVendor] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    shopName: "",
    shopDescription: "",
    phone: "",
    address: "",
    type: "Supermarket",
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      toast({ description: t("vendors.status_updated") });
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: (data: any) => adminApi.registerVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      setIsCreateDialogOpen(false);
      setNewVendor({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        shopName: "",
        shopDescription: "",
        phone: "",
        address: "",
        type: "Supermarket",
      });
      toast({ description: t("vendors.created_success") });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.response?.data?.message || t("common.error")
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => adminApi.uploadVendorImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      setUploadingId(null);
      toast({ description: t("vendors.image_uploaded") });
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.vendors")}</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} />
              {t("vendors.add_new")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t("vendors.add_new_title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("auth.first_name")}</Label>
                  <Input
                    id="firstName"
                    value={newVendor.firstName}
                    onChange={(e) => setNewVendor({ ...newVendor, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("auth.last_name")}</Label>
                  <Input
                    id="lastName"
                    value={newVendor.lastName}
                    onChange={(e) => setNewVendor({ ...newVendor, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newVendor.password}
                    onChange={(e) => setNewVendor({ ...newVendor, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopName">{t("vendors.shop_name")}</Label>
                <Input
                  id="shopName"
                  value={newVendor.shopName}
                  onChange={(e) => setNewVendor({ ...newVendor, shopName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <Input
                    id="phone"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{t("vendors.type")}</Label>
                  <Select
                    value={newVendor.type}
                    onValueChange={(val) => setNewVendor({ ...newVendor, type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Supermarket">Supermarket</SelectItem>
                      <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                      <SelectItem value="Butcher">Butcher</SelectItem>
                      <SelectItem value="Bakery">Bakery</SelectItem>
                      <SelectItem value="Roastery">Roastery</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t("vendors.address")}</Label>
                <Input
                  id="address"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopDescription">{t("common.description")}</Label>
                <Input
                  id="shopDescription"
                  value={newVendor.shopDescription}
                  onChange={(e) => setNewVendor({ ...newVendor, shopDescription: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => createVendorMutation.mutate(newVendor)} disabled={createVendorMutation.isPending}>
                {createVendorMutation.isPending ? t("common.loading") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
