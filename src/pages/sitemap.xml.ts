// Sitemap com lastmod real (dateModified). Um único arquivo comporta até 50.000 URLs.
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { CATEGORIES, categoryUrl } from '../config/categories';
import { getArticles, articleUrl, isoDate } from '../lib/articles';

export const GET: APIRoute = async () => {
  const articles = await getArticles();
  const abs = (p: string) => new URL(p, SITE.url).href;
  const latest = articles[0]?.data.dateModified;

  const urls: { loc: string; lastmod?: string }[] = [
    { loc: abs('/'), lastmod: latest && isoDate(latest) },
    ...CATEGORIES.filter((c) => articles.some((a) => a.data.category === c.slug)).map((c) => ({
      loc: abs(categoryUrl(c.slug)),
    })),
    ...articles.map((a) => ({ loc: abs(articleUrl(a.data.slug)), lastmod: isoDate(a.data.dateModified) })),
    { loc: abs('/sobre/') },
    { loc: abs('/contato/') },
    { loc: abs('/politica-de-privacidade/') },
  ];

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
