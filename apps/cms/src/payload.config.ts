import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig } from 'payload';

import { Media } from './collections/Media';
import { Users } from './collections/Users';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseURL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const remoteStorage = Boolean(process.env.S3_BUCKET);

if (
  remoteStorage &&
  ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL'].some(
    (key) => !process.env[key],
  )
) {
  throw new Error('Complete the S3 endpoint, credentials, and public bucket URL in apps/cms/.env.');
}

if (!process.env.PAYLOAD_SECRET) {
  throw new Error('Set PAYLOAD_SECRET in apps/cms/.env before starting Payload.');
}

if (!databaseURL?.startsWith('postgres')) {
  throw new Error(
    'Set DATABASE_URL to a Neon or local Postgres connection string in apps/cms/.env.',
  );
}

if (process.env.VERCEL && !remoteStorage) {
  throw new Error(
    'Configure S3_BUCKET and the Hetzner storage credentials before deploying the CMS.',
  );
}

export default buildConfig({
  telemetry: false,
  secret: process.env.PAYLOAD_SECRET,
  serverURL: process.env.CMS_PUBLIC_URL || 'http://localhost:3000',
  admin: { user: Users.slug, importMap: { baseDir: dirname } },
  collections: [Users, Media],
  db: postgresAdapter({
    pool: {
      connectionString: databaseURL,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    },
    push: process.env.NODE_ENV === 'development' && !process.env.VERCEL,
  }),
  plugins: [
    s3Storage({
      enabled: remoteStorage,
      alwaysInsertFields: true,
      bucket: process.env.S3_BUCKET || '',
      clientUploads: true,
      collections: {
        media: {
          prefix: 'media/originals',
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) => {
            const key = [prefix, filename]
              .filter(Boolean)
              .map((part) => part!.split('/').map(encodeURIComponent).join('/'))
              .join('/');
            return `${process.env.S3_PUBLIC_URL?.replace(/\/$/, '')}/${key}`;
          },
        },
      },
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'fsn1',
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
  cors: [process.env.WEB_URL || 'http://localhost:4321'],
  csrf: [process.env.CMS_PUBLIC_URL || 'http://localhost:3000'],
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { disable: true },
  upload: { limits: { fileSize: 20 * 1024 * 1024 } },
});
