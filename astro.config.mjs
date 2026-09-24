// @ts-check
import { defineConfig } from 'astro/config';
import { SITE } from './src/config/site.ts';

export default defineConfig({
  site: SITE.url,
  // Mesmo padrão de permalink do WordPress (/%postname%/): sempre com barra final.
  trailingSlash: 'always',
  build: {
    // Gera /slug/index.html → servido como /slug/
    format: 'directory',
  },
  prefetch: false,
});
