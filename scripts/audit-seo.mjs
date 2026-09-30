// Auditoria de SEO (PADRAO_SEO.md). Bloqueante → exit 1 (o build falha). Nota < 80 → só aviso.
// Relatório: reports/auditoria-seo.csv
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadArticles } from './lib.mjs';

const HEALTH = ['corpo-humano', 'psicologia-e-comportamento'];
const HEALTH_RE = /não substitui|profissional de saúde|médico|psicólogo|psiquiatra/i;
const LEFTOVER_RE = /como uma ia|como um modelo de linguagem|\[inserir|lorem ipsum|\[todo/i;
const BAD_SOURCES = /wikipedia\.org|blogspot|medium\.com|quora\.com|reddit\.com/i;
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = (s) => (s.match(/[\p{L}\p{N}'-]+/gu) ?? []).length;

const articles = loadArticles().filter((a) => !a.data.draft);
const kwCount = new Map();
for (const a of articles) kwCount.set(norm(a.data.keyword), (kwCount.get(norm(a.data.keyword)) ?? 0) + 1);

const rows = [];
let blocked = false;

for (const { file, data: d, body } of articles) {
  const block = [], warn = [];
  const text = body.replace(/```[\s\S]*?```/g, '');
  const wc = words(text);
  const kw = norm(d.keyword);
  const h2 = [...text.matchAll(/^## .+$/gm)];
  const firstPara = text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#')) ?? '';
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim() && !/^(#|[-*>|!])/.test(p.trim()));
  const sentences = text.split(/[.!?]+\s/).filter(Boolean);
  const internal = [...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);

  if (/^# /m.test(text)) block.push('B01 H1 no corpo');
  if (wc < 1000) block.push(`B02 ${wc} palavras (mín. 1000)`);
  if (!d.sources?.length) block.push('B03 sem fontes');
  if (kwCount.get(kw) > 1) block.push('B04 keyword repetida em outro artigo');
  if (HEALTH.includes(d.category) && !HEALTH_RE.test(text)) block.push('B05 sem aviso de saúde');
  if (LEFTOVER_RE.test(text)) block.push('B06 resto de rascunho/IA');

  if ((d.seoTitle || d.title).length > 60) warn.push('T01 title > 60');
  if (!norm(d.seoTitle || d.title).includes(kw)) warn.push('T02 keyword fora do title');
  if (d.description.length < 120) warn.push('T03 description < 120');
  if (!norm(d.description).includes(kw)) warn.push('T04 keyword fora da description');
  if (!norm(d.slug).includes(kw.replace(/\s+/g, '-'))) warn.push('T05 keyword fora do slug');
  if (!norm(firstPara).includes(kw)) warn.push('C01 keyword fora do 1º parágrafo');
  if (words(firstPara) > 50) warn.push('C02 1º parágrafo > 50 palavras');
  if (wc < 1200) warn.push('C03 menos de 1200 palavras');
  if (h2.length < 4) warn.push('C04 menos de 4 H2');
  if (internal.length < 2) warn.push('L01 menos de 2 links internos');
  if ((d.sources?.length ?? 0) < 2) warn.push('F01 menos de 2 fontes');
  if (d.sources?.some((s) => BAD_SOURCES.test(s.url))) warn.push('F02 fonte não confiável');
  if (wc / Math.max(sentences.length, 1) > 22) warn.push('Q01 frases longas');
  if (paras.some((p) => words(p) > 50)) warn.push('Q02 parágrafo > 50 palavras');
  if ((text.match(new RegExp(kw, 'g')) ?? []).length * kw.split(' ').length / Math.max(wc, 1) > 0.03) warn.push('Q03 densidade de keyword > 3%');
  const needImgs = wc >= 1200 ? 2 : 1;
  if ((d.images?.length ?? 0) < needImgs && !d.imagensPlano) warn.push(`I01 menos de ${needImgs} foto(s) no corpo`);
  if (d.altConferido === false) warn.push('I06 alt não conferido');

  const score = Math.max(0, 100 - warn.length * 5 - block.length * 20);
  if (block.length) blocked = true;
  rows.push([d.id, d.slug, score, block.join(' | '), warn.join(' | '), wc]);
  if (block.length || score < 80) console.error(`${file}: nota ${score}${block.length ? ' BLOQUEADO: ' + block.join('; ') : ''}`);
}

mkdirSync('reports', { recursive: true });
const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
writeFileSync('reports/auditoria-seo.csv', ['id,slug,nota,bloqueantes,alertas,palavras', ...rows.map((r) => r.map(csv).join(','))].join('\n') + '\n');
console.log(`auditoria: ${rows.length} artigo(s), ${rows.filter((r) => r[3]).length} bloqueado(s)`);
process.exit(blocked ? 1 : 0);
