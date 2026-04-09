import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/AuthProvider";
import { vendorService } from "@/services/api/vendor.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, MapPin, Phone, Store, Eye, Upload } from "lucide-react";
import { toast } from "sonner";
import ProductImageModal from "@/components/ProductImageModal";
import { type UpdateVendorDto } from "@city-market/shared";
import { AxiosError } from "axios";

const Profile = () => {
  const { t } = useTranslation();
  const { vendor } = useAuth();
  const queryClient = useQueryClient();
  const [profileData, setProfileData] = useState({
    name: "",
    description: "",
    address: "",
    phone: "",
  });
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    if (vendor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileData({
        name: vendor.name || "",
        description: vendor.description || "",
        address: vendor.address || "",
        phone: vendor.phone || "",
      });
    }
  }, [vendor]);

  const workingHoursQuery = useQuery({
    queryKey: ["working-hours", vendor?.id],
    queryFn: () => vendorService.getWorkingHours(vendor?.id),
    enabled: !!vendor?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateVendorDto) => vendorService.updateProfile(vendor?.id, data),
    onSuccess: () => {
      toast.success(t("common.profile_updated"));
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => vendorService.uploadImage(vendor?.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] });
      toast.success(t("common.image_uploaded"));
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error?.response?.data?.message || t("common.upload_failed"));
    },
  });

  const handleUpdateProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageMutation.mutate(file);
    }
  };

  return (
    <div className="">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("common.profile")}</h1>
        <p className="text-muted-foreground">{t("common.profile_subtitle")}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Store className="h-4 w-4" /> {t("common.general")}
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="h-4 w-4" /> {t("common.working_hours")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t("common.store_information")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-muted flex-shrink-0">
                  {vendor?.storeImage ? (
                    <img
                      src={
                        vendor.storeImage.startsWith("/")
                          ? `${import.meta.env.VITE_API_BASE_URL}${vendor.storeImage}`
                          : vendor.storeImage
                      }
                      alt="Store"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Store className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-3 text-center sm:text-start">
                  <div>
                    <h3 className="font-medium">{t("common.store_image")}</h3>
                    <p className="text-sm text-muted-foreground">{t("common.store_image_desc")}</p>
                    {uploadImageMutation.isPending && (
                      <p className="text-sm text-primary animate-pulse">{t("common.loading")}</p>
                    )}
                  </div>
                  <div className="flex gap-2 justify-center sm:justify-start">
                    {vendor?.storeImage && (
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsImageModalOpen(true)}>
                        <Eye className="h-4 w-4" />
                        {t("common.view_image")}
                      </Button>
                    )}
                    <Label htmlFor="image-upload" className="cursor-pointer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        type="button"
                        disabled={uploadImageMutation.isPending}
                        asChild
                      >
                        <span>
                          <Upload className="h-4 w-4" />
                          {t("common.upload_new")}
                        </span>
                      </Button>
                    </Label>
                    <input
                      id="image-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadImageMutation.isPending}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("common.store_name")}</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      className="pl-9"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t("common.address")}</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    className="pl-9"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("common.description")}</Label>
                <Input
                  id="description"
                  value={profileData.description}
                  onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                />
              </div>
              <Button onClick={handleUpdateProfile} disabled={updateProfileMutation.isPending}>
                {t("common.save_changes")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>{t("common.working_hours")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workingHoursQuery.data?.map((hour: any) => (
                  <div key={hour.dayOfWeek} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="font-medium">
                      {t("common.day")} {hour.dayOfWeek}
                    </span>
                    <div className="flex items-center gap-4">
                      <span>{hour.openTime}</span>
                      <span>-</span>
                      <span>{hour.closeTime}</span>
                    </div>
                  </div>
                ))}
                {!workingHoursQuery.data?.length && (
                  <p className="text-center py-4 text-muted-foreground">{t("common.no_working_hours")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageUrl={vendor?.storeImage || null}
        productName={vendor?.name || t("common.store_image")}
      />
    </div>
  );
};

export default Profile;
