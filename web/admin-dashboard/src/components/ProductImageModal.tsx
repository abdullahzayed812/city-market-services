import React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  productName: string;
}

const ProductImageModal: React.FC<ProductImageModalProps> = ({ isOpen, onClose, imageUrl, productName }) => {
  const { t } = useTranslation();
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("products.image_for", { name: productName })}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("products.visual_preview")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center p-4">
          {imageUrl ? (
            <img
              src={`${
                import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api/v1`
              }${imageUrl}`}
              alt={productName}
              className="max-w-full h-auto rounded-md"
            />
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center rounded-md text-muted-foreground">
              {t("products.no_image")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductImageModal;
