import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  site: 'https://nickbevers.dev',
  output: 'static',
  // Astro downloads these at build time and serves them from our own domain,
  // so visitors never connect to Google.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Hanken Grotesk',
      cssVariable: '--font-hanken',
      weights: ['400 800'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Fira Code',
      cssVariable: '--font-mono',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
});
