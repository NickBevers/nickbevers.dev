import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getPayload } from 'payload';
import type { ImageStorage } from '../src/lib/process-media';

import { processMediaDocument } from '../src/lib/process-media';

try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const { default: config } = await import('../src/payload.config');
process.env.DISABLE_PAYLOAD_HMR = 'true';
const payload = await getPayload({ config });
const remote = Boolean(process.env.S3_BUCKET);
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'fsn1',
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
});

const storage: ImageStorage = {
  async readOriginal(media) {
    if (!media.filename) throw new Error(`Media ${media.id} has no original filename.`);
    if (!remote) return readFile(path.resolve(process.env.MEDIA_DIR || 'media', media.filename));

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `${media.prefix || 'media/originals'}/${media.filename}`,
      }),
    );
    if (!response.Body) throw new Error(`Media ${media.id} original is empty.`);
    return Buffer.from(await response.Body.transformToByteArray());
  },
  async writeVariant(key, data, contentType) {
    if (remote) {
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: data,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return `${process.env.S3_PUBLIC_URL?.replace(/\/$/, '')}/${key}`;
    }

    const destination = path.resolve('../web/public', key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, data);
    return new URL(key, `${process.env.WEB_URL || 'http://localhost:4321'}/`).href;
  },
};

let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});

try {
  for (;;) {
    const pending = await payload.find({
      collection: 'media',
      where: {
        processingStatus: process.argv.includes('--retry-failed')
          ? { in: ['pending', 'failed'] }
          : { equals: 'pending' },
      },
      limit: 100,
      depth: 0,
      sort: 'createdAt',
    });
    let processed = 0;
    let failed = 0;
    for (const media of pending.docs) {
      if (stopping) break;
      try {
        if (await processMediaDocument(payload, media, storage)) processed++;
      } catch (error) {
        failed++;
        console.error(`Media ${media.id} failed:`, error);
        await payload.update({
          collection: 'media',
          id: media.id,
          data: { processingStatus: 'failed' },
        });
      }
    }
    console.log(`Images: ${processed} processed, ${failed} failed.`);

    if (processed && process.env.WEB_DEPLOY_HOOK) {
      const response = await fetch(process.env.WEB_DEPLOY_HOOK, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Frontend deploy hook failed: ${response.status}`);
    }
    if (failed) process.exitCode = 1;
    if (!process.argv.includes('--watch') || stopping) break;
    await setTimeout(5000);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  s3.destroy();
  await payload.destroy();
  // Payload's Postgres adapter retains its initial pool client; CLI workers exit explicitly.
  process.exit(process.exitCode || 0);
}
