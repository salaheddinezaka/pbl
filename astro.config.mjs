// @ts-check
import { defineConfig } from 'astro/config';

import netlify from '@astrojs/netlify';

import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';

// https://astro.build/config
export default defineConfig({
  adapter: netlify({
    middlewareMode: 'edge'
  }),

  integrations: [react(), markdoc(), keystatic()],

  // Keystatic + Vite 7: avoid stale optimize-dep 504s in the browser and broken
  // SSR module resolution for keystatic.config right after dev-server restarts.
  vite: {
    optimizeDeps: {
      ignoreOutdatedRequests: true,
      include: [
        '@keystatic/core',
        '@keystatic/core/ui',
        '@keystatic/astro/ui',
        '@keystatic/astro/api',
      ],
    },
    ssr: {
      noExternal: ['@keystatic/core', '@keystatic/astro'],
    },
  },
});
