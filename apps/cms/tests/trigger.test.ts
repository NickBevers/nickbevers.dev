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

test('a new or replaced upload starts the processing workflow, and nothing else does', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nickbevers-trigger-'));
  const config = buildConfig({
    secret: 'isolated-trigger-test-secret',
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

  const realFetch = globalThis.fetch;
  const dispatches: { url: string; init?: RequestInit }[] = [];
  let githubDown = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith('https://api.github.com/')) return realFetch(input, init);
    if (githubDown) throw new Error('network down');
    dispatches.push({ url, init });
    return new Response(null, { status: 204 });
  };
  process.env.GITHUB_DISPATCH_TOKEN = 'test-token';

  try {
    const input = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#59736a' },
    })
      .png()
      .toBuffer();
    const file = { data: input, mimetype: 'image/png', name: 'source.png', size: input.length };

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Trigger test' },
      file,
    });
    assert.equal(dispatches.length, 1, 'A new upload starts the workflow');
    const [first] = dispatches;
    assert.equal(
      first.url,
      'https://api.github.com/repos/NickBevers/nickbevers.dev/actions/workflows/process-media.yml/dispatches',
    );
    assert.equal(new Headers(first.init?.headers).get('Authorization'), 'Bearer test-token');
    assert.deepEqual(JSON.parse(String(first.init?.body)), { ref: 'main' });

    await payload.update({ collection: 'media', id: media.id, data: { alt: 'New alt text' } });
    await payload.update({ collection: 'media', id: media.id, data: { focalX: 30, focalY: 60 } });
    // What the worker writes when it finishes.
    await payload.update({
      collection: 'media',
      id: media.id,
      data: { processingStatus: 'ready' },
    });
    assert.equal(dispatches.length, 1, 'Edits and the worker saving its results do not start it');

    await payload.update({ collection: 'media', id: media.id, data: {}, file });
    assert.equal(dispatches.length, 2, 'A replaced file starts it again');

    githubDown = true;
    const offline = await payload.create({
      collection: 'media',
      data: { alt: 'GitHub down' },
      file,
    });
    assert.equal(offline.processingStatus, 'pending', 'A failed trigger never blocks the upload');
    githubDown = false;

    delete process.env.GITHUB_DISPATCH_TOKEN;
    await payload.create({ collection: 'media', data: { alt: 'No token' }, file });
    assert.equal(dispatches.length, 2, 'Without a token, nothing is sent');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GITHUB_DISPATCH_TOKEN;
    (payload.db.client as unknown as { close: () => void }).close();
    await payload.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});
