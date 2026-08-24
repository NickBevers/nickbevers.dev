import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// No adapter
export default defineConfig({
  site: "https://nickbevers.dev",
  // No UI framework
  integrations: [mdx(), sitemap()],
  build: { inlineStylesheets: "auto" },

  markdown: {
    // Shiki emits inline colours from a fixed theme
    shikiConfig: { theme: "css-variables", wrap: false },
  },

  // Prefetch is OFF
  prefetch: false,
});
