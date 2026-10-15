import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { AppError } from "@city-market/shared";
import {
  SubmissionImageRules,
  normalizedWidth,
  parseFormats,
  sniffImageFormat,
  validateAndNormalizeSubmissionImage,
} from "../application/services/submission-image.validator";

const RULES: SubmissionImageRules = {
  formats: ["jpeg", "png", "webp"],
  minWidth: 800,
  minHeight: 800,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 40_000_000,
  outputMaxSide: 1600,
};

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } });

const rejectsWith = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: any) => {
    // (shared AppError resets the prototype, so check the class through AppError + status)
    assert.ok(error instanceof AppError, `expected AppError, got ${error}`);
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, code);
    return true;
  });

describe("accepted images", () => {
  for (const [format, mime] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const) {
    test(`${format} at the minimum size`, async () => {
      const input = await solid(800, 800)[format]().toBuffer();
      const out = await validateAndNormalizeSubmissionImage(input, mime, RULES);
      assert.equal(out.sourceFormat, format);
      assert.equal(out.contentType, "image/webp");
      assert.equal(out.width, 800);
      assert.equal(out.height, 800);
      assert.equal((await sharp(out.buffer).metadata()).format, "webp");
    });
  }

  test("a generic declared type is compared with nothing (content decides)", async () => {
    const input = await solid(900, 900).png().toBuffer();
    const out = await validateAndNormalizeSubmissionImage(input, "application/octet-stream", RULES);
    assert.equal(out.sourceFormat, "png");
  });

  test("large photos shrink to fit 1600 px, keeping the aspect ratio", async () => {
    const input = await solid(3000, 2000).jpeg().toBuffer();
    const out = await validateAndNormalizeSubmissionImage(input, "image/jpeg", RULES);
    assert.equal(out.width, 1600);
    assert.equal(out.height, 1067);
  });

  test("a wide photo is never shrunk below the minimum", async () => {
    const input = await solid(4000, 800).jpeg().toBuffer();
    const out = await validateAndNormalizeSubmissionImage(input, "image/jpeg", RULES);
    assert.equal(out.width, 4000);
    assert.equal(out.height, 800);
    assert.equal(normalizedWidth(4000, 800, RULES), 4000);
    assert.equal(normalizedWidth(1000, 1000, RULES), 1000);
  });

  test("EXIF orientation is applied and metadata stripped", async () => {
    // Stored 900x1200, displayed rotated 90° -> 1200x900
    const input = await solid(900, 1200).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await validateAndNormalizeSubmissionImage(input, "image/jpeg", RULES);
    assert.equal(out.sourceWidth, 1200);
    assert.equal(out.sourceHeight, 900);
    assert.equal(out.width, 1200);
    assert.equal(out.height, 900);
    const meta = await sharp(out.buffer).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.orientation, undefined);
  });
});

describe("rejected images", () => {
  test("smaller than 800 x 800", async () => {
    await rejectsWith(validateAndNormalizeSubmissionImage(await solid(799, 1000).jpeg().toBuffer(), "image/jpeg", RULES), "image_too_small");
    await rejectsWith(validateAndNormalizeSubmissionImage(await solid(1000, 799).png().toBuffer(), "image/png", RULES), "image_too_small");
  });

  test("the rotated size counts", async () => {
    // Stored 1000x700 would pass a naive width check on one side only; displayed it is 700x1000
    await rejectsWith(validateAndNormalizeSubmissionImage(await solid(1000, 700).jpeg().withMetadata({ orientation: 6 }).toBuffer(), "image/jpeg", RULES), "image_too_small");
  });

  test("larger than 5 MB", async () => {
    // Random noise doesn't compress: ~6.7 MB PNG
    const noise = await sharp(randomBytes(1500 * 1500 * 3), { raw: { width: 1500, height: 1500, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    assert.ok(noise.length > RULES.maxBytes);
    await rejectsWith(validateAndNormalizeSubmissionImage(noise, "image/png", RULES), "image_too_large");
  });

  test("unsupported formats, whatever the declared type", async () => {
    const gif = await solid(900, 900).gif().toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(gif, "image/gif", RULES), "image_format_not_allowed");
    await rejectsWith(validateAndNormalizeSubmissionImage(gif, "image/png", RULES), "image_format_not_allowed");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900"/></svg>');
    await rejectsWith(validateAndNormalizeSubmissionImage(svg, "image/svg+xml", RULES), "image_format_not_allowed");
    const pdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj <<>> endobj\n");
    await rejectsWith(validateAndNormalizeSubmissionImage(pdf, "image/jpeg", RULES), "image_format_not_allowed");
    const tiff = await solid(900, 900).tiff().toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(tiff, "image/tiff", RULES), "image_format_not_allowed");
  });

  test("a format turned off in the configuration", async () => {
    const png = await solid(900, 900).png().toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(png, "image/png", { ...RULES, formats: parseFormats("jpeg,webp") }), "image_format_not_allowed");
  });

  test("content that doesn't match the declared type", async () => {
    const png = await solid(900, 900).png().toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(png, "image/jpeg", RULES), "image_type_mismatch");
    const jpeg = await solid(900, 900).jpeg().toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(jpeg, "image/webp", RULES), "image_type_mismatch");
    await rejectsWith(validateAndNormalizeSubmissionImage(jpeg, "text/html", RULES), "image_format_not_allowed");
  });

  test("corrupted or truncated files", async () => {
    const jpeg = await solid(1200, 1200).jpeg({ quality: 95 }).toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(jpeg.subarray(0, Math.floor(jpeg.length / 2)), "image/jpeg", RULES), "image_corrupted");
    const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(5000)]);
    await rejectsWith(validateAndNormalizeSubmissionImage(fakeJpeg, "image/jpeg", RULES), "image_corrupted");
    const png = await solid(900, 900).png().toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(png.subarray(0, 60), "image/png", RULES), "image_corrupted");
    await rejectsWith(validateAndNormalizeSubmissionImage(Buffer.alloc(0), "image/png", RULES), "image_corrupted");
    await rejectsWith(validateAndNormalizeSubmissionImage(Buffer.from("tiny"), "image/png", RULES), "image_corrupted");
  });

  test("decompression bombs (pixel limit)", async () => {
    const big = await solid(1200, 1200).png().toBuffer();
    await rejectsWith(validateAndNormalizeSubmissionImage(big, "image/png", { ...RULES, maxPixels: 1_000_000 }), "image_too_many_pixels");
  });
});

test("magic-byte sniffing", async () => {
  assert.equal(sniffImageFormat(await solid(10, 10).jpeg().toBuffer()), "jpeg");
  assert.equal(sniffImageFormat(await solid(10, 10).png().toBuffer()), "png");
  assert.equal(sniffImageFormat(await solid(10, 10).webp().toBuffer()), "webp");
  assert.equal(sniffImageFormat(await solid(10, 10).gif().toBuffer()), "other");
  assert.equal(sniffImageFormat(Buffer.from("short")), null);
  assert.deepEqual(parseFormats("JPG, png ,bmp"), ["jpeg", "png"]);
  assert.deepEqual(parseFormats(""), ["jpeg", "png", "webp"]);
});
