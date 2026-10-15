// Auditoria objetiva editorial/SEO. Bloqueantes ou nota abaixo de 85 impedem o build.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadArticles } from './lib.mjs';
import { auditarArtigo, norm } from './lib-audit.mjs';

const articles = loadArticles().filter((a) => !a.data.draft);
const kwCount = new Map();
for (const a of articles) kwCount.set(norm(a.data.keyword), (kwCount.get(norm(a.data.keyword)) ?? 0) + 1);

const strictSlug = process.env.AUDIT_STRICT_SLUG?.trim();
const strictArticles = strictSlug ? articles.filter((a) => a.data.slug === strictSlug) : articles;
if (strictSlug && strictArticles.length === 0) {
  console.error(`AUDIT_STRICT_SLUG não corresponde a nenhum artigo: ${strictSlug}`);
  process.exit(1);
}
const strictFiles = new Set(strictArticles.map((a) => a.file));
const rows = [];
let blocked = false;
for (const article of articles) {
  const { score, block, warn, wc } = auditarArtigo(article, kwCount);
  const isStrict = strictFiles.has(article.file);
  const belowThreshold = score < 85;
  if (isStrict && (block.length || belowThreshold)) blocked = true;
  rows.push([article.data.id, article.data.slug, score, block.join(' | '), warn.join(' | '), wc]);
  if (isStrict && (block.length || belowThreshold)) {
    console.error(`${article.file}: nota ${score}${block.length ? ' BLOQUEADO: ' + block.join('; ') : ''}${belowThreshold ? ' | abaixo do mínimo 85/100' : ''}`);
  }
}
mkdirSync('reports', { recursive: true });
const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
writeFileSync('reports/auditoria-seo.csv',
  ['id,slug,nota,bloqueantes,alertas,palavras', ...rows.map((r) => r.map(csv).join(','))].join('\n') + '\n');
console.log(`auditoria: ${rows.length} artigo(s) avaliados; gate estrito em ${strictSlug || 'todos os artigos'}; ${rows.filter((r) => r[3] || r[2] < 85).length} com apontamentos`);
process.exit(blocked ? 1 : 0);
