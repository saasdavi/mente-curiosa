// Pré-build: lê redirects/*.csv, valida e grava os 301 em vercel.json.
// Linhas com 410 ou destino vazio não geram redirect (a Vercel não serve 410 por vercel.json).
import { readFileSync, writeFileSync } from 'node:fs';
import { loadArticles, loadRedirects } from './lib.mjs';

const slugs = new Set(loadArticles().map((a) => a.data.slug));
const rows = loadRedirects();
const errors = [];
const froms = new Set();
const targets = new Map(rows.map((r) => [r.from, r.to]));

for (const r of rows) {
  if (!/^\/[^\s]*\/$/.test(r.from ?? '')) errors.push(`${r.file}: "from" inválido (precisa /caminho/): ${r.from}`);
  if (froms.has(r.from)) errors.push(`${r.file}: redirect duplicado para ${r.from}`);
  froms.add(r.from);
  if (r.to === '') { console.warn(`aviso: ${r.from} sem destino (vira 404)`); continue; }
  if (r.to === '410') continue;
  if (!/^\/[a-z0-9-]+\/$/.test(r.to) || !slugs.has(r.to.slice(1, -1))) errors.push(`${r.file}: destino inexistente: ${r.from} → ${r.to}`);
  if (targets.has(r.to)) errors.push(`${r.file}: cadeia de redirects: ${r.from} → ${r.to} → ${targets.get(r.to)}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
cfg.redirects = rows
  .filter((r) => r.to && r.to !== '410')
  .map((r) => ({ source: r.from, destination: r.to, permanent: true }));
writeFileSync('vercel.json', JSON.stringify(cfg, null, 2) + '\n');
console.log(`redirects: ${cfg.redirects.length} regra(s) em vercel.json`);
