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

  integrations: [react(), markdoc(), keystatic()]
});