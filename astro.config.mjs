// @ts-check
import { defineConfig } from 'astro/config';
import { SITE } from './src/config/site.ts';
import rehypeArticleImages from './src/lib/rehype-article-images.mjs';

export default defineConfig({
  site: SITE.url,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  prefetch: false,
  markdown: { rehypePlugins: [rehypeArticleImages] },
  integrations: [
    // RSS feed será gerado em /rss.xml
  ],
});
