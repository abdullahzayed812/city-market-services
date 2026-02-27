import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShopStatus, type Vendor } from "@city-market/shared"; // Import Vendor type
import { MoreHorizontal, CheckCircle, XCircle, Image as ImageIcon, Upload, Eye } from "lucide-react"; // Add Image, Upload, Eye icons
import { Label } from "@/components/ui/label"; // Import Label
import ProductImageModal from "@/components/ProductImageModal"; // Import ProductImageModal
import { useToast } from "@/hooks/use-toast";

const VendorsManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      try {
        const response = await adminApi.getVendors();
        return response?.data?.data;
      } catch (error) {
        // Mock data
        return [
          {
            id: "1",
            restaurantName: "El Borg Supermarket",
            email: "vendor1@example.com",
            status: ShopStatus.CLOSED, // Placeholder for PENDING
            storeImage: null, // Add storeImage for testing
          },
          {
            id: "2",
            restaurantName: "Fresh Market",
            email: "vendor2@example.com",
            status: ShopStatus.OPEN, // Approved
            storeImage: "/vendors/uploads/vendor-2-image.jpg", // Example image
          },
          {
            id: "3",
            restaurantName: "Tech Haven",
            email: "vendor3@example.com",
            status: ShopStatus.CLOSED, // Rejected
            storeImage: null,
          },
        ];
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ShopStatus }) => adminApi.updateVendorStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => adminApi.uploadVendorImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast({ title: "Success", description: "Vendor image uploaded successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: `Failed to upload image: ${err.message}`, variant: "destructive" });
    },
  });

  const handleImageUpload = (vendorId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageMutation.mutate({ id: vendorId, file });
    }
  };

  if (isLoading) return <div>{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.vendors")}</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead> {/* New Image column */}
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors?.map((vendor: any) => (
              <TableRow key={vendor.id}>
                <TableCell>
                  <div className="relative h-12 w-12 overflow-hidden rounded bg-muted flex-shrink-0">
                    {vendor.storeImage ? (
                      <img
                        src={`${
                          import.meta.env.VITE_API_URL ||
                          `${window.location.protocol}//${window.location.hostname}:3000/api/v1`
                        }${vendor.storeImage}`}
                        alt={vendor.shopName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{vendor.shopName}</TableCell>
                <TableCell>{vendor.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      vendor.status === ShopStatus.OPEN
                        ? "default"
                        : vendor.status === ShopStatus.CLOSED
                        ? "destructive"
                        : vendor.status === ShopStatus.SUSPENDED
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {vendor.status === ShopStatus.OPEN
                      ? t("common.approved")
                      : vendor.status === ShopStatus.CLOSED
                      ? t("common.rejected")
                      : vendor.status === ShopStatus.SUSPENDED
                      ? t("common.suspended")
                      : t("common.pending")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Image Management Actions */}
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setIsImageModalOpen(true);
                        }}
                        disabled={!vendor.storeImage}
                      >
                        <Eye className="me-2 h-4 w-4" />
                        {t("products.view_image")}
                      </DropdownMenuItem>
                      <Label htmlFor={`upload-vendor-image-${vendor.id}`} className="cursor-pointer">
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          {" "}
                          {/* Prevent closing dropdown */}
                          <Upload className="me-2 h-4 w-4" />
                          {t("products.upload_image")}
                        </DropdownMenuItem>
                      </Label>
                      <input
                        id={`upload-vendor-image-${vendor.id}`}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(vendor.id, e)}
                      />

                      {/* Status Update Actions */}
                      <DropdownMenuItem
                        onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: ShopStatus.OPEN })}
                        disabled={vendor.status === ShopStatus.OPEN}
                      >
                        <CheckCircle className="me-2 h-4 w-4" />
                        {t("common.approve")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateStatusMutation.mutate({ id: vendor.id, status: ShopStatus.CLOSED })}
                        disabled={vendor.status === ShopStatus.CLOSED}
                        className="text-destructive"
                      >
                        <XCircle className="me-2 h-4 w-4" />
                        {t("common.reject")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Image Modal for Vendor Store Image */}
      <ProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false);
          setSelectedVendor(null);
        }}
        imageUrl={selectedVendor?.storeImage || null}
        productName={selectedVendor?.shopName || "Vendor Image"}
      />
    </div>
  );
};

export default VendorsManagement;
