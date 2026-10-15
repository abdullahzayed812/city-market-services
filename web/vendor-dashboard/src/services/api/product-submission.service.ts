import apiClient from "./client";
import type {
  ApiResponse,
  ProductDuplicateMatch,
  ProductSubmission,
  ProductSubmissionInput,
  SubmissionImageRules,
  SubmissionImageUploadResult,
} from "@city-market/shared";

// Shown before the rules arrive from the server (same as the server defaults)
export const DEFAULT_IMAGE_RULES: SubmissionImageRules = {
  formats: ["jpeg", "png", "webp"],
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  minWidth: 800,
  minHeight: 800,
  maxBytes: 5 * 1024 * 1024,
};

export const productSubmissionService = {
  getImageRules: async () => (await apiClient.get<ApiResponse<SubmissionImageRules>>("/media/submission-images/rules")).data.data!,

  uploadImage: async (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiClient.post<ApiResponse<SubmissionImageUploadResult>>("/media/submission-images", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
    return response.data.data!;
  },

  checkDuplicates: async (name: string, globalCategoryId?: string) =>
    (await apiClient.post<ApiResponse<{ matches: ProductDuplicateMatch[] }>>("/catalog/product-submissions/check-duplicates", { name, globalCategoryId })).data.data!
      .matches,

  create: async (input: ProductSubmissionInput) => (await apiClient.post<ApiResponse<ProductSubmission>>("/catalog/product-submissions", input)).data.data!,

  update: async (id: string, input: ProductSubmissionInput) =>
    (await apiClient.put<ApiResponse<ProductSubmission>>(`/catalog/product-submissions/${id}`, input)).data.data!,

  cancel: async (id: string) => (await apiClient.post<ApiResponse<ProductSubmission>>(`/catalog/product-submissions/${id}/cancel`)).data.data!,

  list: async (params: { status?: string; page?: number; limit?: number }) =>
    (await apiClient.get<ApiResponse<{ data: ProductSubmission[]; total: number; page: number; limit: number }>>("/catalog/product-submissions/mine", { params }))
      .data.data!,

  get: async (id: string) => (await apiClient.get<ApiResponse<ProductSubmission>>(`/catalog/product-submissions/${id}`)).data.data!,
};
