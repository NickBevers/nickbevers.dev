import type { Payload } from 'payload';
import type { Media } from '../payload-types';

import { generateImageVariants } from './images';

export interface ImageStorage {
  readOriginal(media: Media): Promise<Buffer>;
  writeVariant(key: string, data: Buffer, contentType: string): Promise<string>;
}

export async function processMediaDocument(payload: Payload, media: Media, storage: ImageStorage) {
  const result = await generateImageVariants(await storage.readOriginal(media));
  const variants = [];

  for (const variant of result.variants) {
    const key = `media/variants/${media.id}/${result.hash}/${variant.width}.${variant.format}`;
    const url = await storage.writeVariant(key, variant.data, `image/${variant.format}`);
    variants.push({
      format: variant.format,
      width: variant.width,
      height: variant.height,
      url,
      filesize: variant.data.length,
    });
  }

  const latest = await payload.findByID({ collection: 'media', id: media.id });
  // An edit made during processing must be processed again with the new document.
  if (latest.updatedAt !== media.updatedAt) return false;

  await payload.update({
    collection: 'media',
    id: media.id,
    data: {
      width: result.width,
      height: result.height,
      blurDataURL: result.blurDataURL,
      variants,
      processingStatus: 'ready',
    },
  });
  return true;
}
