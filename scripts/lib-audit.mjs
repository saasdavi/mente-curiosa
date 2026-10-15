// Auditoria objetiva editorial/SEO. Não substitui leitura de fontes nem avaliação editorial humana/LLM.
const HEALTH = ['corpo-humano', 'psicologia-e-comportamento'];
const HEALTH_RE = /não substitui|profissional de saúde|médico|psicólogo|psiquiatra/i;
const LEFTOVER_RE = /como uma ia|como um modelo de linguagem|\[inserir|lorem ipsum|\[todo/i;
const BAD_SOURCES = /wikipedia\.org|blogspot|medium\.com|quora\.com|reddit\.com|brainly/i;
const BANNED_PHRASES = /neste artigo|vamos explorar|mergulhar|jornada|ecossistema|desmistificar|orquestrar|tapeçaria|imersão|catalisador|farol|no cenário atual|\bmilagre\b|\bcura\b|vale ressaltar|é importante destacar|em suma|concluindo|fascinante mundo|desvendar os mistérios|milagroso|garantido|sem efeitos colaterais/i;
const HEALTH_RISK_RE = /medicamento|remédio|fitoterápico|suplemento|hormônio|exame|tratamento|erva|interação medicamentosa/i;
const CONTRA_RE = /contraindica|grupo de risco|gestante|lactante|doença renal|doença hepática|hipertens|diabet/i;
const INTERACTION_RE = /interaç(?:ão|ões)|medicamentos de uso contínuo|remédios de uso contínuo/i;

export const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const countWords = (s) => (s.match(/[\p{L}\p{N}'-]+/gu) ?? []).length;
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sentenceCount = (s) => Math.max((s.match(/[.!?]+(?:\s|$)/g) ?? []).length, 1);

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
  const sentences = sentenceCount(text);
  const internal = [...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
  const sources = d.sources ?? [];
  const title = d.seoTitle || d.title;
  const keywordRegex = kw ? new RegExp(escapeRegExp(kw), 'g') : null;
  const occurrences = keywordRegex ? (norm(text).match(keywordRegex) ?? []).length : 0;
  const density = (occurrences * Math.max(kw.split(' ').length, 1)) / Math.max(wc, 1);

  if (/^# /m.test(text)) block.push('B01 H1 no corpo');
  if (wc < 1300) block.push(`B02 ${wc} palavras (mín. 1300)`);
  if (sources.length < 3) block.push(`B03 ${sources.length} fonte(s) listada(s); mínimo 3`);
  if ((keywordCount.get(kw) ?? 1) > 1) block.push('B04 keyword repetida em outro artigo');
  if (HEALTH.includes(d.category) && !HEALTH_RE.test(text)) block.push('B05 sem aviso de saúde');
  if (LEFTOVER_RE.test(text)) block.push('B06 resto de rascunho/IA');
  if (!/resumindo/i.test(text)) block.push('B07 falta seção Resumindo');
  if (HEALTH.includes(d.category) && !/quando procurar um médico/i.test(text)) block.push('B08 falta seção Quando procurar um médico');
  if (BANNED_PHRASES.test(text)) block.push('B09 linguagem/clichê proibido');
  if (sources.some((s) => BAD_SOURCES.test(s.url))) block.push('B10 fonte proibida ou inadequada');
  if (HEALTH.includes(d.category) && HEALTH_RISK_RE.test(text) && (!CONTRA_RE.test(text) || !INTERACTION_RE.test(text))) {
    block.push('B11 tema de saúde com risco: revisar contraindicações e interações');
  }

  if (title.length + ' | Mente Curiosa'.length > 60 && !d.seoTitle) warn.push('T01 title > 60 com a marca');
  if (!norm(title).includes(kw)) block.push('B12 keyword ausente no title/seoTitle');
  if (d.description.length < 120 || d.description.length > 160) block.push('B13 description fora de 120–160 caracteres');
  if (!norm(d.description).includes(kw)) block.push('B14 keyword ausente na description');
  if (!norm(d.slug).includes(kw.replace(/\s+/g, '-'))) warn.push('T05 keyword fora do slug');
  if (!norm(firstPara).includes(kw)) block.push('B15 keyword ausente no primeiro parágrafo');
  if (countWords(firstPara) > 50) block.push('B16 primeiro parágrafo acima de 50 palavras');
  if (h2.length < 4) block.push('B17 menos de 4 H2');
  if (internal.length < 2) block.push('B18 menos de 2 links internos');
  if (wc / sentences > 22) warn.push('Q01 frases longas');
  if (prose.some((p) => countWords(p.replace(/^#{1,6}\s+/, '')) > 50)) warn.push('Q02 parágrafo > 50 palavras');
  if (density > 0.03) block.push('B20 densidade de keyword acima de 3%');
  if ((d.images?.length ?? 0) < (wc >= 1200 ? 2 : 1) && !d.imagensPlano) warn.push('I01 plano/fotos do corpo insuficientes');
  if (d.altConferido === false) warn.push('I06 alt não conferido');
  const score = Math.max(0, 100 - warn.length * 5 - block.length * 20);
  return { score, block, warn, wc };
}
