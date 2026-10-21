import sharp from 'sharp';
import { createHash } from 'node:crypto';

export const imageWidths = [320, 390, 480, 640, 780, 960, 1280, 1600, 1920, 2400] as const;

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
        format === 'webp' ? image.webp({ quality: 78 }) : image.avif({ quality: 55, effort: 4 })
      ).toBuffer({ resolveWithObject: true });
      variants.push({ format, width: info.width, height: info.height, data: buffer });
    }
  }

  return {
    width,
    height,
    hash: createHash('sha256').update(data).digest('hex').slice(0, 16),
    blurDataURL: await createImagePlaceholder(data),
    variants,
  };
}
