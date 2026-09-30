// Auditoria de SEO (PADRAO_SEO.md). Bloqueante → exit 1 (o build falha). Nota < 80 → só aviso.
// Relatório: reports/auditoria-seo.csv
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadArticles } from './lib.mjs';
import { auditarArtigo, norm } from './lib-audit.mjs';

const articles = loadArticles().filter((a) => !a.data.draft);
const kwCount = new Map();
for (const a of articles) kwCount.set(norm(a.data.keyword), (kwCount.get(norm(a.data.keyword)) ?? 0) + 1);

const rows = [];
let blocked = false;
for (const article of articles) {
  const { score, block, warn, wc } = auditarArtigo(article, kwCount);
  if (block.length) blocked = true;
  rows.push([article.data.id, article.data.slug, score, block.join(' | '), warn.join(' | '), wc]);
  if (block.length || score < 80) {
    console.error(`${article.file}: nota ${score}${block.length ? ' BLOQUEADO: ' + block.join('; ') : ''}`);
  }
}

mkdirSync('reports', { recursive: true });
const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
writeFileSync(
  'reports/auditoria-seo.csv',
  ['id,slug,nota,bloqueantes,alertas,palavras', ...rows.map((r) => r.map(csv).join(','))].join('\n') + '\n',
);
console.log(`auditoria: ${rows.length} artigo(s), ${rows.filter((r) => r[3]).length} bloqueado(s)`);
process.exit(blocked ? 1 : 0);
