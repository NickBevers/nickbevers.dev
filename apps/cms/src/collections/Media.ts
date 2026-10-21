import path from 'node:path';
import type { CollectionConfig } from 'payload';

import { triggerMediaProcessing } from '../lib/trigger-media-processing';

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
      ({ data, req, operation, originalDoc, context }) => {
        if (
          operation === 'create' ||
          req.file ||
          (data.filename && data.filename !== originalDoc?.filename)
        ) {
          data.processingStatus = 'pending';
          data.blurDataURL = null;
          data.variants = [];
          // A point set on the old picture means nothing on the new one.
          data.focalX = 50;
          data.focalY = 50;
          context.queuedForProcessing = true;
        }
        return data;
      },
    ],
    afterChange: [
      // After the save. A workflow run needs about a minute to start, so the upload is committed
      // long before the worker looks for pending images.
      async ({ doc, req, context }) => {
        if (context.queuedForProcessing) await triggerMediaProcessing(req.payload.logger);
        return doc;
      },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    {
      name: 'focalPoint',
      type: 'ui',
      admin: { components: { Field: '/components/FocalPoint/FocalPointField#FocalPointField' } },
    },
    // Payload's own focalPoint option re-uploads the original on every change. These keep the
    // same names and 0 to 100 percentages, but only store the point; the site crops in CSS.
    ...(['focalX', 'focalY'] as const).map((name) => ({
      name,
      type: 'number' as const,
      min: 0,
      max: 100,
      defaultValue: 50,
      admin: { hidden: true },
    })),
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
