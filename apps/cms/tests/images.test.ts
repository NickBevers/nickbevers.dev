import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import { createImagePlaceholder } from '../src/lib/images';

test('generates a small inline 16 × 16 WebP preview from a large source', async () => {
  const image = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#8f6070' },
  })
    .jpeg()
    .toBuffer();
  const dataURL = await createImagePlaceholder(image);
  const preview = Buffer.from(dataURL.split(',')[1], 'base64');
  const metadata = await sharp(preview).metadata();

  assert.match(dataURL, /^data:image\/webp;base64,/);
  assert.equal(metadata.width, 16);
  assert.equal(metadata.height, 16);
  assert.equal(metadata.format, 'webp');
  assert.ok(preview.length < 1024, 'Preview should stay below 1 KB for this fixture');
});

test('handles transparent images without flattening the alpha channel', async () => {
  const image = await sharp({
    create: { width: 100, height: 200, channels: 4, background: '#00000000' },
  })
    .png()
    .toBuffer();
  const dataURL = await createImagePlaceholder(image);
  const metadata = await sharp(Buffer.from(dataURL.split(',')[1], 'base64')).metadata();

  assert.equal(metadata.hasAlpha, true);
});
