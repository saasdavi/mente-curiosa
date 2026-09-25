// RSS dos últimos artigos. Serve de gatilho para automações (ex.: n8n → redes sociais).
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { getCategory } from '../config/categories';
import { getArticles, articleUrl } from '../lib/articles';
import { socialPack } from '../lib/social';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const articles = (await getArticles()).slice(0, 50);
  const abs = (p: string) => new URL(p, SITE.url).href;
  const items = articles
    .map((a) => {
      const d = a.data;
      const url = abs(articleUrl(d.slug));
      const s = socialPack(a);
      const media = [
        `      <media:content url="${abs(d.featuredImage)}" medium="image" type="image/webp" width="1200" height="675"><media:title>${esc(d.featuredImageAlt)}</media:title></media:content>`,
        `      <media:content url="${s.facebook.image}" medium="image" type="image/jpeg"><media:title>facebook</media:title></media:content>`,
        ...s.pinterest.map(
          (p) => `      <media:content url="${p.image}" medium="image" type="image/jpeg" width="1000" height="1500"><media:title>pin-${p.n}: ${esc(p.angle)}</media:title></media:content>`,
        ),
      ].join('\n');
      return `    <item>
      <title>${esc(d.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="false">${d.id}</guid>
      <pubDate>${d.datePublished.toUTCString()}</pubDate>
      <category>${esc(getCategory(d.category).name)}</category>
      <description>${esc(d.description)}</description>
      <enclosure url="${s.facebook.image}" type="image/jpeg" length="0" />
      <media:thumbnail url="${s.facebook.image}" />
${media}
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
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
