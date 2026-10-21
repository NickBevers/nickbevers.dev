import type { Media } from '@site/cms/types';

export function mediaSrcSet(media: Media, format: 'avif' | 'webp'): string | undefined {
  return (
    media.variants
      ?.filter((variant) => variant.format === format)
      .toSorted((a, b) => a.width - b.width)
      .map((variant) => `${variant.url} ${variant.width}w`)
      .join(', ') || undefined
  );
}


// Never use an unprocessed original as the browser fallback. Returns undefined until the worker has made the variants, so the caller can render a placeholder instead of failing the build.
export function mediaFallback(media: Media): string | undefined {
  const variants = media.variants
    ?.filter((variant) => variant.format === 'webp')
    .toSorted((a, b) => a.width - b.width);
  const fallback = variants?.find((variant) => variant.width >= 780) || variants?.at(-1);
  return fallback?.url;
}
