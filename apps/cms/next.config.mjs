import { withPayload } from '@payloadcms/next/withPayload';

export default withPayload({
  agentRules: false,
  poweredByHeader: false,
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  turbopack: { root: new URL('../..', import.meta.url).pathname },
  // Keep every CMS response out of search results, including the public API JSON. Payload's
  // own robots meta tag only covers admin pages. Don't add a robots.txt Disallow: crawlers
  // that can't fetch a page never see this header.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
});
