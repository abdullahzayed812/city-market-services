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

// Product-proposal photos: any declared type is accepted here because the content is
// checked after upload (magic bytes + full decode). Multer errors become clear 400s.
export const submissionImageUpload = (maxBytes: number) => {
  const handler = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1, fields: 5 } }).single("file");
  return (req: any, res: any, next: (err?: any) => void) =>
    handler(req, res, (err?: any) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") return next(new ValidationError("image_too_large"));
      return next(new ValidationError("invalid_upload"));
    });
};
