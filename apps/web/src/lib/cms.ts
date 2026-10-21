import type { Media } from '@site/cms/types';

const cmsURL = import.meta.env.CMS_URL || 'http://localhost:3000';

/** Fetch at build time from Astro frontmatter. Pages remain static and ship no CMS client. */
export async function getMedia(id: number): Promise<Media> {
  const response = await fetch(new URL(`/api/media/${id}?depth=0`, cmsURL), {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Could not load media ${id}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<Media>;
}
