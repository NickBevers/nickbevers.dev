import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// No adapter. The whole site prerenders, so `dist/` deploys anywhere:
// Workers static assets, Coolify, an S3 bucket. Portability for free.
export default defineConfig({
  site: "https://nickbevers.dev",
  // No UI framework. The tag filter. The only interactive widget: was
  // first built as a Preact island and measured at 10.4KB gzipped, ~90% of
  // it framework overhead, for three event listeners and a hidden attribute.
  // The vanilla equivalent is 1.2KB with identical behaviour, verified by
  // scripts/filter-test.mjs. Add @astrojs/preact back when something genuinely
  // needs component state; until then the site ships no framework at all.
  integrations: [mdx(), sitemap()],
  build: { inlineStylesheets: "auto" },

  markdown: {
    // Shiki emits inline colours from a fixed theme. A single theme cannot
    // suit both a light page and dark window chrome, so `css-variables`
    // makes it emit var() references the design tokens resolve per theme.
    shikiConfig: { theme: "css-variables", wrap: false },
  },

  // Prefetch is OFF. Enabling it ships a ~2.5KB runtime to every page,
  // including the ones with no JS at all. On a site this small, over a
  // fast connection, that runtime costs more than the navigation it saves.
  // Revisit only if analytics ever show slow page-to-page transitions.
  prefetch: false,
});
