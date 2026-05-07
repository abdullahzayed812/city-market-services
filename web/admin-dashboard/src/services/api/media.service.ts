import axiosInstance from "./axios-instance";

export interface MediaUploadResult {
  url: string;
  sizes: { small: string; medium: string; large: string };
}

export const mediaService = {
  upload: async (file: File, folder: string, entityId: string): Promise<MediaUploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    formData.append("entityId", entityId);
    const response = await axiosInstance.post<{ data: MediaUploadResult }>("/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data!;
  },
};
