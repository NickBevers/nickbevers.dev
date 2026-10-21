import path from 'node:path';
import type { CollectionConfig } from 'payload';

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { defaultColumns: ['filename', 'alt', 'processingStatus', 'updatedAt'] },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    staticDir: process.env.MEDIA_DIR || path.resolve(process.cwd(), 'media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    crop: false,
    focalPoint: false,
    adminThumbnail: ({ doc }) => {
      if (!Array.isArray(doc.variants)) return false;
      return doc.variants.find((variant) => variant.format === 'webp')?.url || false;
    },
    // Original uploads only. Resizing and encoding runs in the separate worker.
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation, originalDoc }) => {
        if (
          operation === 'create' ||
          req.file ||
          (data.filename && data.filename !== originalDoc?.filename)
        ) {
          data.processingStatus = 'pending';
          data.blurDataURL = null;
          data.variants = [];
        }
        return data;
      },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    {
      name: 'processingStatus',
      type: 'select',
      options: ['pending', 'ready', 'failed'],
      defaultValue: 'pending',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Run pnpm media:process to prepare this upload.',
      },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'blurDataURL',
      type: 'text',
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'variants',
      type: 'array',
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
      fields: [
        { name: 'format', type: 'select', options: ['webp', 'avif'], required: true },
        { name: 'width', type: 'number', required: true },
        { name: 'height', type: 'number', required: true },
        { name: 'url', type: 'text', required: true },
        { name: 'filesize', type: 'number', required: true },
      ],
    },
  ],
};
