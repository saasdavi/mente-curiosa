// Mapa de migração: registro de TODO o acervo (inclusive rascunhos e agendados),
// gerado a cada build. É a base para migrar de plataforma e conferir que nada se perdeu.
import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getCollection } from 'astro:content';
import { SITE } from '../config/site';
import { articleUrl, isoDate } from '../lib/articles';

const COLUMNS = [
  'id', 'slug', 'url', 'title', 'category', 'featuredImage',
  'datePublished', 'dateModified', 'status', 'sourcePath', 'contentHash',
] as const;

const csv = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET: APIRoute = async () => {
  const now = new Date();
  const all = (await getCollection('artigos')).sort((a, b) => a.data.id.localeCompare(b.data.id));

  const rows = all.map((a) => {
    const d = a.data;
    const sourcePath = a.filePath ?? '';
    const contentHash = sourcePath
      ? createHash('sha256').update(readFileSync(sourcePath)).digest('hex').slice(0, 16)
      : '';
    const status = d.draft ? 'draft' : d.datePublished > now ? 'scheduled' : 'published';
    return [
      d.id, d.slug, new URL(articleUrl(d.slug), SITE.url).href, d.title, d.category, d.featuredImage,
      isoDate(d.datePublished), isoDate(d.dateModified), status, sourcePath, contentHash,
    ].map(csv).join(',');
  });

  return new Response([COLUMNS.join(','), ...rows].join('\n') + '\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  });
};
