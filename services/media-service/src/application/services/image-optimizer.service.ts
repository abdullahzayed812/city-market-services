import sharp from "sharp";
import { ImageVariant, IMAGE_VARIANTS } from "../../core/entities/media.entity.js";

export class ImageOptimizerService {
  async processAll(buffer: Buffer): Promise<Record<ImageVariant, Buffer>> {
    const entries = await Promise.all(
      (Object.entries(IMAGE_VARIANTS) as [ImageVariant, { width: number }][]).map(
        async ([variant, { width }]) => {
          const processed = await sharp(buffer)
            .resize(width, null, {
              withoutEnlargement: true,
              fit: "inside",
            })
            .webp({ quality: 80 })
            .toBuffer();

          return [variant, processed] as [ImageVariant, Buffer];
        },
      ),
    );

    return Object.fromEntries(entries) as Record<ImageVariant, Buffer>;
  }
}
