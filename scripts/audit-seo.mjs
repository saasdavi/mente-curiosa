// Auditoria de qualidade SEO dos artigos — aplica o PADRAO_SEO.md.
// Uso:  npm run audit                  → relatório de todos os artigos
//       npm run audit -- <slug> [...]  → só os artigos indicados
// Saída: tabela no terminal + reports/auditoria-seo.csv (vai para a aba SEO_DIARIO).
// Código de saída 1 se algum artigo tiver regra BLOQUEANTE violada (usado no build).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';

const DIR = 'src/content/artigos';
const SITE_SUFFIX = ' | Mente Curiosa';
const HEALTH = new Set(['corpo-humano', 'psicologia-e-comportamento']);
const MIN_SCORE = 80;

// Frases de enchimento típicas de texto automático: sinal de baixa qualidade.
const FILLER = [
  'neste artigo', 'nesse artigo', 'neste post', 'vamos explorar', 'mergulhar', 'no mundo de hoje',
  'nos dias de hoje', 'é importante ressaltar', 'é importante destacar', 'vale ressaltar',
  'em suma', 'em conclusão', 'concluindo', 'sem mais delongas', 'fascinante mundo', 'desvendar os mistérios',
  'jornada', 'no cenário atual', 'como uma ia', 'como modelo de linguagem',
];

const norm = (s = '') =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);
const STOP = new Set('a o e de do da dos das que por para com um uma os as em no na nos nas se sao como qual quais porque'.split(' '));
const contentWords = (s) => words(s).filter((w) => !STOP.has(w));
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (new Set([...A, ...B]).size || 1);
};

function parse(file) {
  const raw = readFileSync(`${DIR}/${file}`, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: frontmatter ausente`);
  return { file, data: yaml.load(m[1]), body: m[2] };
}

function audit(a, all) {
  const d = a.data;
  const body = a.body;
  const text = body.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_>`|-]/g, ' ');
  const wc = words(text).length;
  const kw = norm(d.keyword || '');
  const kwWords = contentWords(d.keyword || '');
  const hasKw = (s) => kwWords.length > 0 && kwWords.every((w) => contentWords(s).includes(w));
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !/^(#|[-*] |\d+\. |>|\||!\[)/.test(p));
  const firstP = paragraphs[0] || '';
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((h) => ({ level: h[1].length, text: h[2] }));
  const links = [...body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((l) => l[1]);
  const internal = links.filter((l) => l.startsWith('/'));
  const internalArticles = internal.filter((l) => !l.startsWith('/categoria/'));
  const sentences = text.split(/[.!?]+\s/).map((s) => words(s).length).filter((n) => n > 2);
  const avgSentence = sentences.reduce((x, y) => x + y, 0) / (sentences.length || 1);
  const kwCount = kw ? (norm(text).match(new RegExp(`\\b${kw}\\b`, 'g')) || []).length : 0;
  const density = kw ? (kwCount * kwWords.length) / (wc || 1) : 0;
  const lower = norm(body);
  const fillers = FILLER.filter((f) => lower.includes(norm(f)));
  const fullTitle = (d.seoTitle || d.title || '') + SITE_SUFFIX;

  const R = [];
  const rule = (id, level, ok, msg, pts) => R.push({ id, level, ok: Boolean(ok), msg, pts });

  // --- Bloqueantes (o artigo não vai ao ar) ---
  rule('B01', 'BLOQUEANTE', !headings.some((h) => h.level === 1), 'Sem H1 no corpo (o H1 é o title)', 0);
  rule('B02', 'BLOQUEANTE', wc >= 600, `Mínimo de 600 palavras — abaixo disso o AdSense vê conteúdo raso (tem ${wc})`, 0);
  rule('B03', 'BLOQUEANTE', Array.isArray(d.sources) && d.sources.length >= 1, 'Ao menos 1 fonte em sources', 0);
  rule('B04', 'BLOQUEANTE', !all.some((o) => o !== a && norm(o.data.keyword) === kw), 'Keyword principal única no acervo (canibalização)', 0);
  rule('B05', 'BLOQUEANTE', !HEALTH.has(d.category) || /substitui|profissional de saude|orientacao medica/.test(lower),
    'Aviso de saúde nos clusters Corpo humano / Psicologia', 0);
  rule('B06', 'BLOQUEANTE', !/como (uma )?ia|modelo de linguagem|lorem ipsum|\[inserir|todo:/.test(lower), 'Sem restos de rascunho/IA no texto', 0);

  // --- Pontuação (100 pontos) ---
  rule('T01', 'ALERTA', fullTitle.length <= 60, `Title no Google ≤ 60 caracteres (tem ${fullTitle.length}; use seoTitle)`, 8);
  rule('T02', 'ALERTA', hasKw(d.seoTitle || d.title), 'Keyword principal no title', 8);
  rule('T03', 'ALERTA', (d.description || '').length >= 120, `Description entre 120 e 160 caracteres (tem ${(d.description || '').length})`, 5);
  rule('T04', 'ALERTA', hasKw(d.description), 'Keyword (ou suas palavras) na description', 4);
  rule('T05', 'ALERTA', kwWords.every((w) => d.slug.includes(w.slice(0, 5))), 'Slug contém a keyword', 3);
  rule('C01', 'ALERTA', hasKw(firstP), 'Primeiro parágrafo contém a keyword', 7);
  rule('C02', 'ALERTA', words(firstP).length <= 50, `Primeiro parágrafo responde direto (≤ 50 palavras; tem ${words(firstP).length})`, 8);
  rule('C03', 'ALERTA', wc >= 800, `Profundidade: ≥ 800 palavras (tem ${wc})`, 6);
  rule('C04', 'ALERTA', headings.filter((h) => h.level === 2).length >= 4, `≥ 4 seções H2 (tem ${headings.filter((h) => h.level === 2).length})`, 6);
  rule('C05', 'ALERTA', headings.every((h, i) => i === 0 || h.level <= headings[i - 1].level + 1), 'Hierarquia de títulos sem pular nível', 3);
  rule('C06', 'ALERTA', /mitos?|verdade|perguntas|curiosidades|exemplos/.test(norm(headings.map((h) => h.text).join(' '))),
    'Seção de valor extra (mitos e verdades, exemplos, curiosidades ou perguntas)', 4);
  rule('C07', 'ALERTA', /resumindo|resumo|em poucas palavras/.test(norm(headings.map((h) => h.text).join(' '))), 'Resumo final em seção própria', 3);
  rule('L01', 'ALERTA', internal.length >= 2, `≥ 2 links internos (tem ${internal.length})`, 7);
  rule('L02', 'ALERTA', internalArticles.length >= 1 || all.length < 3, 'Link para outro artigo (não só categoria)', 4);
  rule('F01', 'ALERTA', (d.sources || []).length >= 2, `≥ 2 fontes confiáveis (tem ${(d.sources || []).length})`, 6);
  rule('F02', 'ALERTA', (d.sources || []).every((s) => !/wikipedia|blogspot|medium\.com|quora|brainly/.test(s.url)),
    'Fontes primárias (sem Wikipédia, blogs, fóruns)', 4);
  rule('Q01', 'ALERTA', fillers.length === 0, `Sem frases de enchimento${fillers.length ? ': ' + fillers.join(', ') : ''}`, 5);
  rule('Q02', 'ALERTA', avgSentence <= 22, `Frases curtas (média ≤ 22 palavras; tem ${avgSentence.toFixed(1)})`, 3);
  const longP = paragraphs.filter((p) => words(p).length > 50).length;
  rule('Q03', 'ALERTA', longP === 0, `Parágrafos curtos para celular (≤ 50 palavras; ${longP} acima)`, 3);
  // Um subtítulo (H2/H3) a cada ≤ 300 palavras: leitura escaneável e espaço natural para anúncios.
  const secWords = body.split(/^#{2,3}\s.*$/m).map((t) => words(t.replace(/!\[[^\]]*\]\([^)]*\)/g, '')).length);
  const maxSec = Math.max(...secWords);
  rule('C08', 'ALERTA', maxSec <= 300, `Subtítulo a cada ≤ 300 palavras (maior trecho sem subtítulo: ${maxSec})`, 3);
  rule('Q04', 'ALERTA', density <= 0.03, `Sem excesso de keyword (densidade ${(density * 100).toFixed(1)}%)`, 3);
  rule('I01', 'ALERTA', (d.featuredImageAlt || '').length >= 25 && !/^(imagem|foto|ilustracao) de\b/.test(norm(d.featuredImageAlt)),
    'Alt da imagem descritivo (≥ 25 caracteres, sem “imagem de”)', 3);
  const imgs = d.images || [];
  const generic = /\/(capa|image|imagem|img|foto|photo|pexels|dsc|screenshot)[-_]?\d*\.webp$/i;
  rule('I02', 'ALERTA', imgs.length >= 1, `≥ 1 foto no corpo do artigo (tem ${imgs.length}; ideal 2 em artigos longos)`, 5);
  rule('I03', 'ALERTA', ![d.featuredImage, ...imgs.map((i) => i.src)].some((p) => generic.test(p || '')),
    'Nomes de arquivo descritivos (sem capa.webp, img1.webp…)', 2);
  rule('I04', 'ALERTA', imgs.every((i) => i.credit && i.caption && norm(i.alt) !== norm(d.featuredImageAlt)) && Boolean(d.imageCredit),
    'Toda imagem com crédito/licença, legenda e alt próprio', 2);
  rule('I05', 'ALERTA', wc < 1200 || imgs.length >= 2, 'Artigo longo (≥ 1200 palavras) com ≥ 2 fotos no corpo', 1);
  const similar = all.filter((o) => o !== a && jaccard(contentWords(o.data.title), contentWords(d.title)) >= 0.75);
  rule('X01', 'ALERTA', similar.length === 0, `Título não quase-duplicado${similar.length ? ' (parecido com: ' + similar.map((s) => s.data.slug).join(', ') + ')' : ''}`, 3);

  const max = R.reduce((s, r) => s + r.pts, 0);
  const got = R.filter((r) => r.ok).reduce((s, r) => s + r.pts, 0);
  const score = Math.round((got / max) * 100);
  const blocked = R.some((r) => r.level === 'BLOQUEANTE' && !r.ok);
  return { slug: d.slug, id: d.id, words: wc, score, blocked, rules: R };
}

const only = process.argv.slice(2);
const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));
const all = files.map(parse);
const targets = only.length ? all.filter((a) => only.includes(a.data.slug)) : all;
const results = targets.map((a) => audit(a, all));

const today = new Date().toISOString().slice(0, 10);
const csv = [['DATA', 'ID_ARTIGO', 'SLUG', 'SCORE', 'SITUACAO', 'PALAVRAS', 'REGRA', 'NIVEL', 'PROBLEMA'].join(',')];
for (const r of results) {
  const status = r.blocked ? 'BLOQUEADO' : r.score >= MIN_SCORE ? 'APROVADO' : 'REVISAR';
  console.log(`\n${status.padEnd(9)} ${String(r.score).padStart(3)}/100  ${r.id}  ${r.slug}  (${r.words} palavras)`);
  for (const f of r.rules.filter((x) => !x.ok)) {
    console.log(`   ${f.level === 'BLOQUEANTE' ? '✖' : '•'} ${f.id} ${f.msg}`);
    csv.push([today, r.id, r.slug, r.score, status, r.words, f.id, f.level, `"${f.msg.replace(/"/g, '""')}"`].join(','));
  }
  if (r.rules.every((x) => x.ok)) csv.push([today, r.id, r.slug, r.score, status, r.words, '', '', 'sem pendências'].join(','));
}
mkdirSync('reports', { recursive: true });
writeFileSync('reports/auditoria-seo.csv', csv.join('\n') + '\n');
const blocked = results.filter((r) => r.blocked).length;
console.log(`\n${results.length} artigo(s) · ${blocked} bloqueado(s) · nota mínima para publicar: ${MIN_SCORE} · relatório: reports/auditoria-seo.csv`);
process.exit(blocked ? 1 : 0);
