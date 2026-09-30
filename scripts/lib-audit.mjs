// Regras de auditoria de SEO (PADRAO_SEO.md), reutilizadas pelo `npm run audit` e pela automação de artigos.
// Bloqueante → o artigo não vai ao ar. Nota < 80 → alerta.

const HEALTH = ['corpo-humano', 'psicologia-e-comportamento'];
const HEALTH_RE = /não substitui|profissional de saúde|médico|psicólogo|psiquiatra/i;
const LEFTOVER_RE = /como uma ia|como um modelo de linguagem|\[inserir|lorem ipsum|\[todo/i;
const BAD_SOURCES = /wikipedia\.org|blogspot|medium\.com|quora\.com|reddit\.com|brainly/i;
const BANNED_PHRASES = /neste artigo|vamos explorar|mergulhar|jornada|vale ressaltar|é importante destacar|em suma|concluindo|fascinante mundo|desvendar os mistérios|no cenário atual/i;

export const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const countWords = (s) => (s.match(/[\p{L}\p{N}'-]+/gu) ?? []).length;

/** keywordCount: Map(keyword normalizada → quantos artigos usam). */
export function auditarArtigo({ data: d, body }, keywordCount = new Map()) {
  const block = [];
  const warn = [];
  const text = body.replace(/```[\s\S]*?```/g, '');
  const wc = countWords(text);
  const kw = norm(d.keyword);
  const h2 = [...text.matchAll(/^## .+$/gm)];
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim());
  const firstPara = paragraphs.find((p) => p && !p.startsWith('#')) ?? '';
  const prose = paragraphs.filter((p) => p && !/^(#|[-*>|!])/.test(p));
  const sentences = text.split(/[.!?]+\s/).filter(Boolean);
  const internal = [...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);

  if (/^# /m.test(text)) block.push('B01 H1 no corpo');
  if (wc < 1000) block.push(`B02 ${wc} palavras (mín. 1000)`);
  if (!d.sources?.length) block.push('B03 sem fontes');
  if ((keywordCount.get(kw) ?? 1) > 1) block.push('B04 keyword repetida em outro artigo');
  if (HEALTH.includes(d.category) && !HEALTH_RE.test(text)) block.push('B05 sem aviso de saúde');
  if (LEFTOVER_RE.test(text)) block.push('B06 resto de rascunho/IA');

  const title = d.seoTitle || d.title;
  if (title.length + ' | Mente Curiosa'.length > 60 && !d.seoTitle) warn.push('T01 title > 60 com a marca');
  if (!norm(title).includes(kw)) warn.push('T02 keyword fora do title');
  if (d.description.length < 120) warn.push('T03 description < 120');
  if (!norm(d.description).includes(kw)) warn.push('T04 keyword fora da description');
  if (!norm(d.slug).includes(kw.replace(/\s+/g, '-'))) warn.push('T05 keyword fora do slug');
  if (!norm(firstPara).includes(kw)) warn.push('C01 keyword fora do 1º parágrafo');
  if (countWords(firstPara) > 50) warn.push('C02 1º parágrafo > 50 palavras');
  if (wc < 1200) warn.push('C03 menos de 1200 palavras');
  if (h2.length < 4) warn.push('C04 menos de 4 H2');
  if (internal.length < 2) warn.push('L01 menos de 2 links internos');
  if ((d.sources?.length ?? 0) < 2) warn.push('F01 menos de 2 fontes');
  if (d.sources?.some((s) => BAD_SOURCES.test(s.url))) warn.push('F02 fonte não confiável');
  if (wc / Math.max(sentences.length, 1) > 22) warn.push('Q01 frases longas');
  if (prose.some((p) => countWords(p) > 50)) warn.push('Q02 parágrafo > 50 palavras');
  if (BANNED_PHRASES.test(text)) warn.push('Q04 frase proibida (REGRAS_OURO 13)');
  const occurrences = (text.match(new RegExp(kw, 'g')) ?? []).length;
  if ((occurrences * kw.split(' ').length) / Math.max(wc, 1) > 0.03) warn.push('Q03 densidade de keyword > 3%');
  const needImgs = wc >= 1200 ? 2 : 1;
  if ((d.images?.length ?? 0) < needImgs && !d.imagensPlano) warn.push(`I01 menos de ${needImgs} foto(s) no corpo`);
  if (d.altConferido === false) warn.push('I06 alt não conferido');

  const score = Math.max(0, 100 - warn.length * 5 - block.length * 20);
  return { score, block, warn, wc };
}
