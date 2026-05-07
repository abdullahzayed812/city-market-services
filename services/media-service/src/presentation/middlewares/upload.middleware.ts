import multer from "multer";
import { ValidationError } from "@city-market/shared";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError("invalid_file_type_allowed_jpeg_png_webp"));
    }
  },
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});
