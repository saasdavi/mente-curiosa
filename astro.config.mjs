// @ts-check
import { defineConfig } from 'astro/config';
import { SITE } from './src/config/site.ts';
import rehypeArticleImages from './src/lib/rehype-article-images.mjs';

export default defineConfig({
  site: SITE.url,
  // Mesmo padrão de permalink do WordPress (/%postname%/): sempre com barra final.
  trailingSlash: 'always',
  build: {
    // Gera /slug/index.html → servido como /slug/
    format: 'directory',
  },
  prefetch: false,
  markdown: { rehypePlugins: [rehypeArticleImages] },
});
