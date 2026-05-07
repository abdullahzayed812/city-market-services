import React, { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { mediaService, type MediaUploadResult } from "@/services/api/media.service";
import { useToast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  folder: string;
  entityId: string;
  currentImageUrl?: string | null;
  onComplete: (result: MediaUploadResult) => void;
  className?: string;
  children?: React.ReactNode;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ folder, entityId, currentImageUrl, onComplete, className, children }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await mediaService.upload(file, folder, entityId);
      onComplete(result);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={`relative group ${className ?? ""}`}>
      {children ?? (
        currentImageUrl ? (
          <img src={currentImageUrl} alt="" className="h-10 w-10 object-cover rounded border" />
        ) : (
          <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-400 border">
            <Upload size={16} />
          </div>
        )
      )}
      <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
        {uploading ? <Loader2 size={14} className="text-white animate-spin" /> : <Upload size={14} className="text-white" />}
      </label>
    </div>
  );
};

export default ImageUploader;
