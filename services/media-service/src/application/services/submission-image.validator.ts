import sharp from "sharp";
import { ValidationError } from "@city-market/shared";

export type SubmissionImageFormat = "jpeg" | "png" | "webp";

export interface SubmissionImageRules {
  formats: SubmissionImageFormat[];
  minWidth: number;
  minHeight: number;
  maxBytes: number;
  maxPixels: number;
  // The stored copy is re-encoded to fit inside maxSide x maxSide (never enlarged)
  outputMaxSide: number;
}

export interface NormalizedSubmissionImage {
  buffer: Buffer;
  contentType: "image/webp";
  // Of the stored (normalized) copy
  width: number;
  height: number;
  // Of the upload, after EXIF orientation
  sourceWidth: number;
  sourceHeight: number;
  sourceFormat: SubmissionImageFormat;
}

const MIME_BY_FORMAT: Record<SubmissionImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const DECLARED_MIME_TO_FORMAT: Record<string, SubmissionImageFormat> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

// Clients that don't know the type send one of these; there is nothing to compare against
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export const mimeTypesFor = (formats: SubmissionImageFormat[]): string[] => formats.map((f) => MIME_BY_FORMAT[f]);

export function parseFormats(value: string): SubmissionImageFormat[] {
  const allowed = new Set<SubmissionImageFormat>(["jpeg", "png", "webp"]);
  const formats = value
    .split(",")
    .map((f) => f.trim().toLowerCase().replace(/^jpg$/, "jpeg"))
    .filter((f): f is SubmissionImageFormat => allowed.has(f as SubmissionImageFormat));
  return formats.length > 0 ? Array.from(new Set(formats)) : ["jpeg", "png", "webp"];
}

// The real type, from the file's magic bytes. Anything else (GIF, SVG, HEIC, PDF, ...) is "other".
export function sniffImageFormat(buffer: Buffer): SubmissionImageFormat | "other" | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return "other";
}

// Content checks for a product-proposal photo, then a normalized copy: EXIF orientation
// applied, metadata stripped, re-encoded as WebP inside outputMaxSide (aspect ratio kept,
// never cropped or stretched). Watermarks, ads or unsuitable pictures can't be detected
// here; admins check those visually during review.
export async function validateAndNormalizeSubmissionImage(
  input: Buffer,
  declaredMime: string | undefined,
  rules: SubmissionImageRules,
): Promise<NormalizedSubmissionImage> {
  if (!input || input.length === 0) throw new ValidationError("image_corrupted");
  if (input.length > rules.maxBytes) throw new ValidationError("image_too_large");

  const sniffed = sniffImageFormat(input);
  if (sniffed === null) throw new ValidationError("image_corrupted");
  if (sniffed === "other" || !rules.formats.includes(sniffed)) throw new ValidationError("image_format_not_allowed");

  const declared = (declaredMime ?? "").toLowerCase().split(";")[0].trim();
  if (!GENERIC_MIME_TYPES.has(declared)) {
    const declaredFormat = DECLARED_MIME_TO_FORMAT[declared];
    if (!declaredFormat) throw new ValidationError("image_format_not_allowed");
    if (declaredFormat !== sniffed) throw new ValidationError("image_type_mismatch");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: rules.maxPixels, failOn: "truncated" }).metadata();
  } catch (error) {
    throw mapSharpError(error);
  }
  if (metadata.format !== sniffed) throw new ValidationError("image_type_mismatch");
  if ((metadata.pages ?? 1) > 1) throw new ValidationError("image_animated_not_allowed");
  if (!metadata.width || !metadata.height) throw new ValidationError("image_corrupted");
  if (metadata.width * metadata.height > rules.maxPixels) throw new ValidationError("image_too_many_pixels");

  // EXIF orientations 5-8 rotate by 90°: the displayed width is the stored height
  const rotated = (metadata.orientation ?? 1) >= 5;
  const sourceWidth = rotated ? metadata.height : metadata.width;
  const sourceHeight = rotated ? metadata.width : metadata.height;
  if (sourceWidth < rules.minWidth || sourceHeight < rules.minHeight) throw new ValidationError("image_too_small");

  // Fully decoding the image is what catches truncated / damaged files
  try {
    const { data, info } = await sharp(input, { limitInputPixels: rules.maxPixels, failOn: "truncated" })
      .rotate()
      .resize({ width: normalizedWidth(sourceWidth, sourceHeight, rules), fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      contentType: "image/webp",
      width: info.width,
      height: info.height,
      sourceWidth,
      sourceHeight,
      sourceFormat: sniffed,
    };
  } catch (error) {
    throw mapSharpError(error);
  }
}

// Fit inside outputMaxSide, but never shrink a side below the minimum (a 4000x800 panorama
// stays 4000x800 rather than becoming 1600x320). Only the width is given, so the height
// follows the aspect ratio.
export function normalizedWidth(width: number, height: number, rules: SubmissionImageRules): number {
  const fit = Math.min(rules.outputMaxSide / width, rules.outputMaxSide / height, 1);
  const floor = Math.max(rules.minWidth / width, rules.minHeight / height);
  return Math.round(width * Math.min(1, Math.max(fit, floor)));
}

function mapSharpError(error: unknown): ValidationError {
  const message = String((error as any)?.message ?? "");
  if (/pixel limit/i.test(message)) return new ValidationError("image_too_many_pixels");
  return new ValidationError("image_corrupted");
}
