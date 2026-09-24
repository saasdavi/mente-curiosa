// RSS dos últimos artigos. Serve de gatilho para automações (ex.: n8n → redes sociais).
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { getCategory } from '../config/categories';
import { getArticles, articleUrl } from '../lib/articles';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const articles = (await getArticles()).slice(0, 50);
  const abs = (p: string) => new URL(p, SITE.url).href;
  const items = articles
    .map((a) => {
      const d = a.data;
      const url = abs(articleUrl(d.slug));
      return `    <item>
      <title>${esc(d.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="false">${d.id}</guid>
      <pubDate>${d.datePublished.toUTCString()}</pubDate>
      <category>${esc(getCategory(d.category).name)}</category>
      <description>${esc(d.description)}</description>
      <enclosure url="${abs(d.featuredImage)}" type="image/webp" length="0" />
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${abs('/')}</link>
    <description>${esc(SITE.description)}</description>
    <language>${SITE.lang}</language>
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
