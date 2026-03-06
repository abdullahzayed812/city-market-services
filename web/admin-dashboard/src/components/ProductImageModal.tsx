import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  productName: string;
}

const ProductImageModal: React.FC<ProductImageModalProps> = ({ isOpen, onClose, imageUrl, productName }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Image for {productName}</DialogTitle>
          <DialogDescription className="sr-only">
            Visual preview of the product image.
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
              No Image Available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductImageModal;
