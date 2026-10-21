import sharp from 'sharp';
import { createHash } from 'node:crypto';

// Covers 1x and 2x screens for the 680px prose column and the 1240px measure.
export const imageWidths = [480, 780, 1280, 1920, 2400] as const;

export async function createImagePlaceholder(data: Buffer): Promise<string> {
  const preview = await sharp(data)
    .rotate()
    .resize(16, 16, { fit: 'fill' })
    .webp({ quality: 35 })
    .toBuffer();

  return `data:image/webp;base64,${preview.toString('base64')}`;
}

export async function generateImageVariants(data: Buffer) {
  const metadata = await sharp(data).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Image dimensions are missing.');
  const rotated = (metadata.orientation || 0) >= 5;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  const widths = [
    ...new Set<number>([...imageWidths.filter((size) => size <= width), Math.min(width, 2400)]),
  ].toSorted((a, b) => a - b);
  const variants = [];

  // Process sequentially to bound CPU and memory on a small local / CI worker.
  for (const size of widths) {
    for (const format of ['webp', 'avif'] as const) {
      const image = sharp(data).rotate().resize({ width: size, withoutEnlargement: true });
      const { data: buffer, info } = await (
        format === 'webp' ? image.webp({ quality: 78 }) : image.avif({ quality: 55, effort: 2 })
      ).toBuffer({ resolveWithObject: true });
      variants.push({ format, width: info.width, height: info.height, data: buffer });
    }
  }

  // The preview sits behind the image, so it would show through transparent areas. Only fully
  // opaque images get one; they cover it completely once loaded, even without JavaScript.
  const { isOpaque } = await sharp(data).stats();

  return {
    width,
    height,
    hash: createHash('sha256').update(data).digest('hex').slice(0, 16),
    blurDataURL: isOpaque ? await createImagePlaceholder(data) : null,
    variants,
  };
}
