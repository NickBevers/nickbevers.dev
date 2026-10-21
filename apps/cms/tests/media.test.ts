import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { buildConfig, getPayload } from 'payload';
import sharp from 'sharp';

import { Media } from '../src/collections/Media';
import { Users } from '../src/collections/Users';
import { processMediaDocument } from '../src/lib/process-media';

test('uploads queue originals, the separate worker saves variants, and unauthenticated writes fail', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nickbevers-media-'));
  const config = buildConfig({
    secret: 'isolated-image-pipeline-test-secret',
    collections: [
      Users,
      {
        ...Media,
        upload: { ...(typeof Media.upload === 'object' ? Media.upload : {}), staticDir: directory },
      },
    ],
    db: sqliteAdapter({ client: { url: `file:${path.join(directory, 'test.db')}` }, push: true }),
    typescript: { autoGenerate: false },
    telemetry: false,
  });
  const payload = await getPayload({ config });

  try {
    const input = await sharp({
      create: { width: 800, height: 400, channels: 3, background: '#8f6070' },
    })
      .png()
      .toBuffer();
    const file = { data: input, mimetype: 'image/png', name: 'source.png', size: input.length };

    await assert.rejects(
      payload.create({ collection: 'media', data: { alt: 'Denied' }, file, overrideAccess: false }),
      /not allowed|forbidden/i,
    );
    const media = await payload.create({ collection: 'media', data: { alt: 'Test image' }, file });
    assert.equal(media.mimeType, 'image/png', 'CMS must preserve the original without encoding');
    assert.equal(media.processingStatus, 'pending');
    assert.equal(media.blurDataURL, null);
    assert.equal(media.variants?.length, 0);

    const files = new Map<string, Buffer>();
    await processMediaDocument(payload, media, {
      readOriginal: async () => input,
      writeVariant: async (key, data) => {
        files.set(key, data);
        return `https://media.example.com/${key}`;
      },
    });
    const saved = await payload.findByID({
      collection: 'media',
      id: media.id,
      overrideAccess: false,
    });
    assert.equal(saved.processingStatus, 'ready');
    assert.match(saved.blurDataURL || '', /^data:image\/webp;base64,/);
    const preview = await sharp(Buffer.from(saved.blurDataURL!.split(',')[1], 'base64')).metadata();
    assert.equal(preview.width, 16);
    assert.equal(preview.height, 16);

    for (const variant of saved.variants || []) {
      const key = new URL(variant.url).pathname.slice(1);
      const metadata = await sharp(files.get(key)!).metadata();
      assert.equal(metadata.format, variant.format === 'avif' ? 'heif' : 'webp');
      assert.equal(metadata.width, variant.width);
      assert.ok(variant.width <= 800, 'Do not upscale sources');
      assert.ok(variant.width < 960, 'Do not send 2K variants for an 800px source');
    }
    assert.ok(
      saved.variants?.some((variant) => variant.width === 480 && variant.format === 'webp'),
    );
    assert.ok(
      saved.variants?.some((variant) => variant.width === 780 && variant.format === 'avif'),
    );

    assert.equal(media.focalX, 50, 'New uploads start with a centred focal point');
    assert.equal(media.focalY, 50);
    const focused = await payload.update({
      collection: 'media',
      id: media.id,
      data: { focalX: 20, focalY: 75 },
    });
    assert.equal(focused.focalX, 20);
    assert.equal(focused.focalY, 75);
    assert.equal(focused.processingStatus, 'ready', 'Moving the focal point must not reprocess');
    assert.equal(focused.variants?.length, saved.variants?.length);

    const replaced = await payload.update({ collection: 'media', id: media.id, data: {}, file });
    assert.equal(replaced.focalX, 50, 'A new file resets the focal point');
    assert.equal(replaced.focalY, 50);
    assert.equal(replaced.processingStatus, 'pending');
  } finally {
    (payload.db.client as unknown as { close: () => void }).close();
    await payload.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});
